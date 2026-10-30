'use client';

/**
 * 대화 레일의 앱 내 이동 훅 — 전환(transition) 안에서 `router.push`하고, 이동 중인 목적지와
 * 시작·종료 알림을 관리한다.
 */
import {
    useEffect,
    useEffectEvent,
    useRef,
    useState,
    useTransition,
    type MouseEvent,
} from 'react';
import { useRouter } from 'next/navigation';

interface UseRailNavigationInput {
    /** 이동이 **시작된 순간** 목적지와 함께 불린다 — 본문이 그 사이 골격을 그린다. */
    onNavigationStart?: (href: string) => void;
    /** 전환이 끝났을 때 불린다(모바일 서랍이 이때 닫힌다). */
    onNavigate?: () => void;
}

interface UseRailNavigationReturn {
    isNavigating: boolean;
    /** 목적지로 이동을 시작한다. */
    startNavigationTo: (href: string) => void;
    /** 링크 클릭 핸들러 — 일반 왼쪽 클릭만 가로채고 새 탭 열기는 그대로 둔다. */
    navigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
    /** 그 목적지로 이동 중인가. */
    isPending: (href: string) => boolean;
}

/** 수정 키·가운데 클릭 등 브라우저 기본 동작(새 탭)을 살려야 하는 클릭인가. */
function isModifiedClick(event: MouseEvent<HTMLAnchorElement>): boolean {
    return (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
    );
}

/**
 * 평범한 `<a href>`는 문서를 통째로 다시 읽어 대화 전환마다 골격이 번쩍였다. 전환 안의
 * `router.push`는 다음 화면이 준비될 때까지 지금 화면을 유지하고, 그동안 누른 행은 흐리게 둔다.
 *
 * `onNavigate`는 전환이 **끝날 때** 부른다 — 모바일 서랍은 이때 닫히며 레일을 언마운트하는데,
 * 시작할 때 부르면 `role="status"` 안내와 `aria-busy` 행이 스크린 리더가 읽기 전에 사라진다.
 */
export function useRailNavigation({
    onNavigationStart,
    onNavigate,
}: UseRailNavigationInput): UseRailNavigationReturn {
    const router = useRouter();
    const [isNavigating, startTransition] = useTransition();
    const [pendingHref, setPendingHref] = useState<string | null>(null);
    const wasNavigatingRef = useRef(false);
    // 부모의 인라인 화살표(매 렌더 새 함수)를 effect deps에 두지 않으려고 감싼다.
    const notifyNavigated = useEffectEvent(() => onNavigate?.());

    useEffect(() => {
        if (wasNavigatingRef.current && !isNavigating) notifyNavigated();
        wasNavigatingRef.current = isNavigating;
    }, [isNavigating]);

    const startNavigationTo = (href: string): void => {
        setPendingHref(href);
        onNavigationStart?.(href);
        startTransition(() => router.push(href));
    };

    const navigate = (
        event: MouseEvent<HTMLAnchorElement>,
        href: string
    ): void => {
        if (isModifiedClick(event)) return;
        event.preventDefault();
        startNavigationTo(href);
    };

    return {
        isNavigating,
        startNavigationTo,
        navigate,
        isPending: href => isNavigating && pendingHref === href,
    };
}
