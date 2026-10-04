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
import { predictGuardedLanding } from '@/shared/config/authGuardPaths';
import { readAuthHintCookie } from '@/shared/lib/auth/readAuthHintCookie';

/**
 * 도착 신호 없이 pending을 푸는 상한.
 *
 * 종료 판정은 경로 변경과 popstate뿐이라, 예측하지 못한 리디렉트로 **같은 경로에
 * 되돌아오면** 풀 신호가 없다. 그때 골격이 화면을 계속 덮지 않게 하는 마지막 안전망이다.
 * 콜드 RSC(실측 1.7s, 꼬리 2.6s)보다 충분히 길어야 한다 — 짧으면 느린 이동 도중에
 * 떠나온 화면이 다시 튀어나온다.
 */
const PENDING_TIMEOUT_MS = 10_000;

interface PendingNavigation {
    /**
     * **예상 도착** 앱 경로(로케일 접두사·쿼리 없음). 보통은 클릭한 목적지 그대로지만,
     * 프록시 인증 가드가 다른 곳으로 보낼 이동은 그 도착지다(`predictGuardedLanding`).
     */
    href: string;
    /** 이동을 시작한 시점의 앱 경로 — 여기서 벗어나면 이동이 끝난 것이다. */
    from: string;
    /**
     * 골격을 보이려고 맨 위로 올리기 전의 스크롤 위치. 올리지 않았으면 null.
     * 도착 없이 포기할 때(타임아웃) 떠나온 화면을 있던 자리로 되돌리는 데 쓴다.
     */
    restoreScrollY: number | null;
}

interface NavigationPendingValue {
    /** 진행 중인 앱 내 이동의 예상 도착 앱 경로. 없으면 null. */
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
 * 그래서 클라이언트에서 클릭 즉시 이 상태를 세우고, 소비처(진행 바, 루트 골격
 * 슬롯, 종목 탭 슬롯)가 곧바로 목적지 모양을 그린다. 서버 렌더·직접 접속에는
 * 관여하지 않는다 — 초기값이 항상 null이다.
 *
 * 종료: 경로가 시작 시점과 달라지면(도착) 렌더 중 조정으로, 뒤로가기(popstate)면
 * 이벤트로 푼다. 쿼리만 바뀌는 이동은 경로가 안 바뀌어 풀 수 없으므로 애초에
 * 세우지 않는다(타임프레임 전환은 자체 pending을 가진다). 같은 이유로 **인증 가드가
 * 지금 경로로 되돌려 보낼 이동**(로그인 상태로 홈에서 `/login` 클릭 등)도 세우지
 * 않는다 — 도착지를 힌트 쿠키로 예측한다. 예측이 빗나가 경로가 안 바뀐 채 끝난
 * 이동은 `PENDING_TIMEOUT_MS`가 푼다.
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

    useEffect(() => {
        if (pending === null) return;
        const timer = window.setTimeout(() => {
            // 도착하지 못했다. 떠나온 화면이 다시 보이므로 읽던 자리로 되돌린다.
            if (pending.restoreScrollY !== null) {
                window.scrollTo(0, pending.restoreScrollY);
            }
            setPending(null);
        }, PENDING_TIMEOUT_MS);
        return () => window.clearTimeout(timer);
    }, [pending]);

    // 소비처가 `startNavigation`을 자기 useCallback/useEffect deps에 넣으므로
    // (React Compiler가 켜져 있어도) 참조를 명시적으로 안정시킨다.
    const startNavigation = useCallback(
        (href: string) => {
            const target = predictGuardedLanding(
                toAppPath(href),
                readAuthHintCookie()
            );
            if (target === pathname) {
                // 지금 경로로 가는 클릭은 pending을 세우지 않는다(풀 신호가 없다).
                // 다만 **앞선 이동이 아직 pending이면 그것을 푼다** — /market에서
                // /news를 누른 뒤 도착 전에 /market 링크를 누르면 라우터는 앞선 이동을
                // 버리고 제자리에 남는데, 풀지 않으면 /news 골격이 타임아웃까지 남는다.
                setPending(null);
                return;
            }
            // 루트 슬롯은 떠나온 페이지를 숨기고 골격을 그린다. 길게 스크롤한 상태면
            // 문서가 짧아지며 푸터 근처에 걸려 골격이 안 보이므로 먼저 위로 올린다
            // (도착하면 라우터도 어차피 맨 위로 올린다). 같은 종목의 탭 이동은
            // `[symbol]` 레이아웃 안쪽 슬롯만 바뀌므로 그대로 둔다.
            //
            // 올리는 것은 되돌릴 수 없는 부수효과라 원래 위치를 함께 적어 둔다.
            // 뒤로가기로 취소하면 브라우저가 스크롤을 복원하고, 타임아웃으로 포기하면
            // 위 effect가 복원한다. 지금 경로로 되돌아오는 클릭(위 분기)은 라우터가
            // 같은 URL로 이동하며 스스로 맨 위로 올리므로 복원하지 않는다.
            const scrollsToTop = !isSameSymbol(target, pathname);
            const restoreScrollY = scrollsToTop ? window.scrollY : null;
            if (scrollsToTop) window.scrollTo(0, 0);
            setPending({ href: target, from: pathname, restoreScrollY });
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

/** 두 앱 경로가 같은 종목의 라우트인가(종목 밖이면 false). */
function isSameSymbol(a: string, b: string): boolean {
    const symbol = symbolOfAppPath(a);
    return symbol !== null && symbol === symbolOfAppPath(b);
}

/**
 * 루트 page slot이 골격으로 바꿔야 하는 이동이면 그 예상 도착 경로 — 아니면 null.
 *
 * 같은 종목 안의 탭 이동은 뺀다. 그쪽은 `[symbol]` 레이아웃이 헤더·탭을 그대로 둔 채
 * 자기 page slot에서 처리한다(`SymbolTabPendingContext`).
 */
export function usePendingRouteEntry(): string | null {
    const { pendingHref } = useNavigationPending();
    const pathname = useAppPathname();
    if (pendingHref === null || isSameSymbol(pendingHref, pathname)) {
        return null;
    }
    return pendingHref;
}
