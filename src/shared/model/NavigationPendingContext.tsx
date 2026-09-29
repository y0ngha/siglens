'use client';

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';
import { splitLocalePath } from '@/shared/i18n/locales';
import { useAppPathname } from '@/shared/i18n/useAppPathname';
import { symbolOfAppPath } from '@/shared/config/reservedFirstSegments';
import { PendingSlot } from '@/shared/ui/PendingSlot';

interface PendingNavigation {
    /** 목적지 앱 경로(로케일 접두사·쿼리 없음). */
    href: string;
    /** 이동을 시작한 시점의 앱 경로 — 여기서 벗어나면 이동이 끝난 것이다. */
    from: string;
}

interface NavigationPendingValue {
    /** 진행 중인 앱 내 이동의 목적지 앱 경로. 없으면 null. */
    pendingHref: string | null;
    /** 로케일 접두사가 붙었든 아니든 같은 앱 안의 목적지 href를 받는다. */
    startNavigation: (href: string) => void;
}

const NavigationPendingContext = createContext<NavigationPendingValue>({
    pendingHref: null,
    startNavigation: () => {},
});

function toAppPath(href: string): string {
    const pathname = new URL(href, 'http://x').pathname;
    return splitLocalePath(pathname).path;
}

/**
 * 앱 안 내비게이션의 "누른 순간" 상태.
 *
 * 내부 링크는 RSC 비용 때문에 대부분 `prefetch={false}`다(CDN_CACHING.md §1). 그러면
 * 라우터는 목적지 RSC(종목 라우트 0.9~2.7MB)를 **다 받은 뒤에야** 커밋할 수 있고,
 * 그동안 React는 떠나온 화면을 그대로 들고 있다 — 사용자에겐 "데이터를 다 받고
 * 나서 화면이 바뀌는" 것으로 보였다. 서버 경계(`[locale]/loading.tsx`, 레이아웃
 * 위 Suspense)로 메우면 `[symbol]` 레이아웃의 `notFound()`가 경계 안으로 들어가
 * soft 404(200)가 되고, ISR 응답은 통째로 버퍼링돼 스트리밍 이득도 없다.
 *
 * 그래서 클라이언트에서 클릭 즉시 이 상태를 세우고, 소비처(진행 바, 종목 골격
 * 슬롯)가 곧바로 목적지 모양을 그린다. 서버 렌더·직접 접속에는 관여하지 않는다
 * — 초기값이 항상 null이다.
 *
 * 종료: 경로가 시작 시점과 달라지면(도착) 렌더 중 조정으로, 뒤로가기(popstate)면
 * 이벤트로 푼다. 쿼리만 바뀌는 이동은 경로가 안 바뀌어 풀 수 없으므로 애초에
 * 세우지 않는다(타임프레임 전환은 자체 pending을 가진다).
 */
export function NavigationPendingProvider({
    children,
}: {
    children: ReactNode;
}) {
    const pathname = useAppPathname();
    const [pending, setPending] = useState<PendingNavigation | null>(null);

    if (pending !== null && pending.from !== pathname) {
        setPending(null);
    }

    useEffect(() => {
        const stop = () => setPending(null);
        window.addEventListener('popstate', stop);
        return () => window.removeEventListener('popstate', stop);
    }, []);

    // 소비처가 `startNavigation`을 자기 useCallback/useEffect deps에 넣으므로
    // (React Compiler가 켜져 있어도) 참조를 명시적으로 안정시킨다.
    const startNavigation = useCallback(
        (href: string) => {
            const target = toAppPath(href);
            if (target === pathname) return;
            setPending({ href: target, from: pathname });
        },
        [pathname]
    );

    const value: NavigationPendingValue = useMemo(
        () => ({
            pendingHref: pending?.href ?? null,
            startNavigation,
        }),
        [pending, startNavigation]
    );

    return (
        <NavigationPendingContext.Provider value={value}>
            {children}
        </NavigationPendingContext.Provider>
    );
}

export function useNavigationPending(): NavigationPendingValue {
    return useContext(NavigationPendingContext);
}

/**
 * 다른 종목(또는 종목 밖)에서 종목 라우트로 가는 중이면 그 종목 — 아니면 null.
 * 같은 종목 안의 탭 이동은 `[symbol]` 레이아웃이 자기 page slot에서 처리한다.
 */
export function usePendingSymbolEntry(): string | null {
    const { pendingHref } = useNavigationPending();
    const pathname = useAppPathname();
    if (pendingHref === null) return null;
    const target = symbolOfAppPath(pendingHref);
    if (target === null) return null;
    return target === symbolOfAppPath(pathname) ? null : target;
}

/**
 * 루트 page slot. 종목으로 진입하는 중이면 떠나온 페이지 대신 `fallback`(종목 골격)을
 * 보여준다. 뼈대는 `PendingSlot` 참고 — 여기서는 "종목 진입 중인가"만 판정한다.
 */
export function SymbolEntryPendingSlot({
    children,
    fallback,
}: {
    children: ReactNode;
    fallback: ReactNode;
}) {
    const isEntering = usePendingSymbolEntry() !== null;
    return (
        <PendingSlot isPending={isEntering} fallback={fallback}>
            {children}
        </PendingSlot>
    );
}
