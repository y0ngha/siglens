'use client';

import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type RefObject,
} from 'react';
import {
    completeFrame,
    runPlayback,
    type Frame,
    type PlaybackContext,
} from '@/shared/lib/replay/replayPlayer';
import type { ReplayScenario } from '@/shared/lib/replay/replayScript';
import { useCanAnimate } from './useCanAnimate';

export interface ReplayPlayback {
    /** 지금 그릴 프레임. 서버·첫 렌더는 첫 시나리오의 완성본이다. */
    readonly frame: Frame;
    readonly paused: boolean;
    readonly togglePaused: () => void;
    /** 서버·첫 렌더·모션 감소 설정에서는 `false`. */
    readonly animated: boolean;
    /** 카드에 붙인다 — 화면 밖에 있는 동안 재생이 멈춘다. */
    readonly rootRef: RefObject<HTMLDivElement | null>;
    /** 스크롤되는 본문에 붙인다 — 가장 새 텍스트를 따라간다. */
    readonly threadRef: RefObject<HTMLDivElement | null>;
}

/**
 * `replayPlayer`의 React 쪽 어댑터. `ChatReplay`(ai.siglens.io/about)와
 * `ReportReplay`(siglens.io/about)가 함께 쓴다.
 *
 * SSR과 첫 클라이언트 렌더는 첫 시나리오를 완성된 채로 보여 줘서, 크롤러와 JS 없는
 * 독자도 완전한 예시를 받고 하이드레이션도 어긋나지 않는다. 재생은 마운트 뒤에
 * 시작하며 모션 감소 설정이면 시작하지 않는다. 카드가 화면 밖이거나 `togglePaused`를
 * 눌렀을 때 멈춘다 — 스스로 5초 넘게 움직이는 콘텐츠에는 정지 수단이 필요하다
 * (WCAG 2.2.2).
 */
export function useReplayPlayback(
    scenarios: readonly ReplayScenario[]
): ReplayPlayback {
    const [frame, setFrame] = useState<Frame>(() => completeFrame(0));
    const [paused, setPaused] = useState(false);
    const pausedRef = useRef(false);
    const visibleRef = useRef(true);
    const rootRef = useRef<HTMLDivElement>(null);
    const threadRef = useRef<HTMLDivElement>(null);
    const animated = useCanAnimate();

    useEffect(() => {
        pausedRef.current = paused;
    }, [paused]);

    useEffect(() => {
        const root = rootRef.current;
        if (!root || typeof IntersectionObserver === 'undefined') return;
        const observer = new IntersectionObserver(entries => {
            visibleRef.current = entries[0]?.isIntersecting ?? true;
        });
        observer.observe(root);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!animated) return;
        let cancelled = false;
        const timers = new Set<ReturnType<typeof setTimeout>>();
        const ctx: PlaybackContext = {
            scenarios,
            setFrame,
            isCancelled: () => cancelled,
            isRunning: () => !pausedRef.current && visibleRef.current,
            addTimer: id => {
                timers.add(id);
            },
            random: Math.random,
        };

        void runPlayback(ctx);

        return () => {
            cancelled = true;
            for (const id of timers) clearTimeout(id);
        };
    }, [animated, scenarios]);

    // 본문이 고정 높이 카드를 넘치면 가장 새 텍스트가 보이도록 맨 아래로 내린다.
    useEffect(() => {
        const thread = threadRef.current;
        if (thread) thread.scrollTop = thread.scrollHeight;
    }, [frame]);

    const togglePaused = useCallback(() => setPaused(p => !p), []);

    return {
        frame,
        paused,
        togglePaused,
        animated,
        rootRef,
        threadRef,
    };
}
