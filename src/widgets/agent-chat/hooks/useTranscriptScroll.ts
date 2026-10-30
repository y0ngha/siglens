'use client';

/**
 * 대화 본문 스크롤 훅 — 전송한 질문을 화면 위에 고정(anchor-on-send), 대화 열기 시 맨 아래로
 * 점프, "맨 아래로" 버튼 노출, 그 버튼으로 켜는 스트리밍 따라가기(opt-in follow)를 맡는다.
 */
import {
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type RefObject,
    type UIEvent,
} from 'react';
import type { AgentUiMessage } from '@/features/agent-chat/model/types';

/**
 * "맨 아래 근처" 기준(px) — "맨 아래로" 버튼(spec §3.9). 스트리밍 중 자동 따라가기는 기본이
 * 아니다(읽는 자리를 지키고, 전송한 질문은 화면 위에 고정된다) — 그 버튼을 누를 때만 켜진다.
 */
const SCROLL_BOTTOM_THRESHOLD_PX = 80;

/**
 * 따라가기가 도달한 최고점보다 `scrollTop`이 얼마나 내려가야(px) 사용자가 위로 올린 것으로 보고
 * 따라가기를 끝내는가. "여전히 맨 아래" 띠이기도 하다 — 그 안에 떨어지면 레이아웃 클램프나 iOS
 * 고무줄 복귀이지 사용자가 떠난 게 아니다. 우리 고정은 `scrollTop`을 아래로만 옮긴다.
 */
const USER_SCROLL_UP_TOLERANCE_PX = 4;

/**
 * 내용 증가 관찰자의 판정 여유(px). 스크롤 핸들러보다 낮다 — 느린 위 스크롤은 프레임마다 몇 px씩
 * 움직여, 증가할 때마다 다시 고정하면 누적 하강이 핸들러 여유에 닿지 못한다.
 */
const PIN_DRIFT_TOLERANCE_PX = 1;

/** 스크롤 핸들러와 내용 증가 관찰자가 같이 쓰는 판정 — 두 벌로 갈라지지 않게 한 곳에 둔다. */
function isAwayFromBottom(el: HTMLElement): boolean {
    return (
        el.scrollHeight - el.scrollTop - el.clientHeight >
        SCROLL_BOTTOM_THRESHOLD_PX
    );
}

/** 감속 모션 선호가 없으면 `false` — `matchMedia`가 없는 테스트/SSR 환경도 있다. */
function prefersReducedMotion(): boolean {
    return (
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    );
}

interface UseTranscriptScrollReturn {
    containerRef: RefObject<HTMLDivElement | null>;
    contentRef: RefObject<HTMLDivElement | null>;
    endRef: RefObject<HTMLDivElement | null>;
    /** 사용자 메시지 노드 등록 콜백 — 전송 고정의 스크롤 대상이 된다. */
    registerUserNode: (id: string) => (el: HTMLElement | null) => void;
    /** 진행 중인(마지막) 턴에 걸 최소 높이(px). 없으면 null. */
    activeMinHeight: number | null;
    showScrollButton: boolean;
    handleScroll: (e: UIEvent<HTMLDivElement>) => void;
    scrollToBottom: () => void;
}

/**
 * 진행 턴의 최소 높이는 `{ px }`로 감싸 둔다 — 스크롤 뷰포트 높이는 세션 내내 거의 같아 연속된
 * 두 고정이 같은 숫자를 쓰기 쉽고, 숫자 state면 같은 값에 리렌더를 건너뛰어 아래 layout effect가
 * 두 번째 고정에서 돌지 않는다. 스트리밍이 끝나도 지우지 않는다 — 짧은 답에서 페이지가 줄며 튄다.
 *
 * 고정은 감지(새 사용자 메시지 → 최소 높이 + 대상 id ref)와 스크롤(최소 높이가 커밋된 뒤의 layout
 * effect) 두 단계다 — 같은 effect에서 스크롤하면 아직 짧은 옛 레이아웃을 기준으로 해 긴 대화
 * 끝에서 질문이 위에 닿지 못한다. 대상 id는 렌더와 무관해 ref로 둔다.
 *
 * 대화 열기·전환은 호출부가 `key`로 다시 마운트하므로 마운트 effect가 곧 "전환 시 맨 아래로"다.
 */
export function useTranscriptScroll(
    messages: AgentUiMessage[],
    streaming: boolean
): UseTranscriptScrollReturn {
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [activeMinHeight, setActiveMinHeight] = useState<{
        px: number;
    } | null>(null);
    const pendingAnchorIdRef = useRef<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const endRef = useRef<HTMLDivElement>(null);
    const userNodeRefs = useRef(new Map<string, HTMLElement>());
    const seenLastUserIdRef = useRef<string | null>(null);
    const isFirstRenderRef = useRef(true);
    /**
     * opt-in 따라가기(spec §3.9): 스트리밍 중 "맨 아래로"를 누르면 켜져 내용이 자라는 대로 맨
     * 아래에 붙인다. 위로 스크롤하거나 스트림이 끝나면 꺼진다. 렌더와 무관한 명령형 스크롤만
     * 조종하므로 ref다.
     */
    const followingRef = useRef(false);
    /**
     * 따라가기 중 도달한 최고 `scrollTop` — 우리 고정과 아래 스크롤이 올린다. 직전 이벤트가
     * 아니라 이 최고점과 비교해야 프레임당 1~3px의 느린 위 스크롤도 누적돼 "떠남"으로 잡힌다.
     */
    const followPeakTopRef = useRef(0);

    /** 따라가기 최고점에서 `tolerance`보다 내려왔고, 맨 아래 띠에서도 벗어났다(클램프·고무줄 제외). */
    const userScrolledUpFromPeak = (
        el: HTMLElement,
        tolerance: number
    ): boolean =>
        followPeakTopRef.current - el.scrollTop > tolerance &&
        el.scrollHeight - el.scrollTop - el.clientHeight >
            USER_SCROLL_UP_TOLERANCE_PX;

    const handleScroll = (e: UIEvent<HTMLDivElement>): void => {
        const el = e.currentTarget;
        if (followingRef.current) {
            const nearBottom =
                el.scrollHeight - el.scrollTop - el.clientHeight <=
                USER_SCROLL_UP_TOLERANCE_PX;
            // 맨 아래 띠 안에서는 최고점이 `scrollTop`을 그대로 따른다 — 클램프·고무줄 복귀 뒤의
            // 진짜 위 스크롤을 실제 맨 아래에서부터 잰다.
            if (nearBottom || el.scrollTop > followPeakTopRef.current)
                followPeakTopRef.current = el.scrollTop;
            else if (userScrolledUpFromPeak(el, USER_SCROLL_UP_TOLERANCE_PX))
                followingRef.current = false;
        }
        setShowScrollButton(isAwayFromBottom(el));
    };

    const scrollToBottom = (): void => {
        const el = containerRef.current;
        if (!el) return;
        // 스트리밍 중에 누르면 자라는 답을 따라가기로 고른 것이다.
        if (streaming) {
            followingRef.current = true;
            followPeakTopRef.current = el.scrollTop;
        }
        el.scrollTo({
            top: el.scrollHeight,
            behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        });
        // 맨 아래에 닿으면 버튼이 사라져 키보드 포커스가 `<body>`로 떨어진다. 로그에 둔다(입력창은
        // 터치 기기에서 화상 키보드를 띄운다) — 화살표·PageUp이 계속 본문을 스크롤한다.
        el.focus({ preventScroll: true });
    };

    useLayoutEffect(() => {
        if (!pendingAnchorIdRef.current) return;
        userNodeRefs.current
            .get(pendingAnchorIdRef.current)
            ?.scrollIntoView({ block: 'start' });
        pendingAnchorIdRef.current = null;
    }, [activeMinHeight]);

    useEffect(() => {
        endRef.current?.scrollIntoView({ block: 'end' });
    }, []);

    useEffect(() => {
        if (!streaming) followingRef.current = false;
    }, [streaming]);

    // `showScrollButton`은 스크롤 이벤트로만 갱신되는데, 스트리밍 답은 스크롤 이벤트 없이
    // `scrollHeight`를 키운다 — 내용 크기를 관찰해 그 증가를 잡는다. 따라가기 고정도 여기서 한다
    // (토큰마다 부드러운 애니메이션은 글자보다 늦으므로 즉시 이동).
    useEffect(() => {
        const content = contentRef.current;
        const container = containerRef.current;
        if (!content || !container) return;
        const observer = new ResizeObserver(() => {
            // 핸들러가 아직 충분히 보지 못한 위 스크롤이 고정을 이겨야 따라가기에서 나올 수 있다.
            if (
                followingRef.current &&
                userScrolledUpFromPeak(container, PIN_DRIFT_TOLERANCE_PX)
            )
                followingRef.current = false;
            if (followingRef.current) {
                container.scrollTop = container.scrollHeight;
                followPeakTopRef.current = container.scrollTop;
            }
            setShowScrollButton(isAwayFromBottom(container));
        });
        observer.observe(content);
        return () => observer.disconnect();
    }, []);

    // 전송 고정 감지(ChatGPT/Gemini 패턴): 새 사용자 메시지가 나타나면 진행 턴 최소 높이를 키우고
    // 스크롤 대상을 기록한다. 첫 렌더의 마지막 사용자 메시지는 마운트 effect(맨 아래로)의 몫이다.
    useEffect(() => {
        const lastUser = messages.findLast(m => m.role === 'user');
        if (isFirstRenderRef.current) {
            isFirstRenderRef.current = false;
            seenLastUserIdRef.current = lastUser?.id ?? null;
            return;
        }
        if (!lastUser || lastUser.id === seenLastUserIdRef.current) return;
        seenLastUserIdRef.current = lastUser.id;
        // 새 턴은 화면 위에 고정된다 — 이전 답의 따라가기를 넘겨 받지 않는다.
        followingRef.current = false;
        if (containerRef.current)
            setActiveMinHeight({ px: containerRef.current.clientHeight });
        pendingAnchorIdRef.current = lastUser.id;
    }, [messages]);

    return {
        containerRef,
        contentRef,
        endRef,
        registerUserNode: id => el => {
            if (el) userNodeRefs.current.set(id, el);
            else userNodeRefs.current.delete(id);
        },
        activeMinHeight: activeMinHeight?.px ?? null,
        showScrollButton,
        handleScroll,
        scrollToBottom,
    };
}
