'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Header, type HeaderUserMenuUser } from '@/widgets/layout';
import { useCurrentUser, useAuthHint } from '@/entities/auth';
import { QUERY_KEYS } from '@/shared/config/queryConfig';

/**
 * Root layout 헤더를 클라이언트에서 렌더한다.
 *
 * 서버 컴포넌트가 cookies()를 호출하면 (cacheComponents/PPR 비활성 상태에서)
 * Suspense 경계 안이라도 전 라우트가 dynamic으로 강제돼 ISR이 깨진다. 그래서
 * 인증 상태 조회를 클라이언트로 이전했다 — root layout 정적 셸에는 dynamic API가
 * 남지 않으므로 모든 라우트가 정적 캐시(ISR) 가능해진다.
 *
 * - hint 쿠키(siglens_auth='1', non-httpOnly)를 useAuthHint(document.cookie)로 읽어
 *   hydration 동안 낙관적 skeleton(loadingUserMenu)을 추정한다.
 * - 실제 auth 상태는 useCurrentUser()(currentUserAction → httpOnly 세션 + DB)가
 *   마운트 후 확정한다. cookies()는 클라가 트리거하는 server action 안에서만 실행되며
 *   static render 트리에는 없다.
 *
 * 보안: hint 쿠키는 값이 '1' 플래그뿐(PII 없음)이고 이미 non-httpOnly다. 권한 판단은
 * 전적으로 httpOnly 세션 + DB로만 이뤄지므로 클라가 hint를 읽어도 표면이 넓어지지 않는다.
 */
export function AuthSessionHeaderClient() {
    const syncedPathRef = useRef<string | null>(null);
    const hasHint = useAuthHint();
    const { data: user, isPending } = useCurrentUser();
    const queryClient = useQueryClient();
    const pathname = usePathname();

    // 정적 ISR 셸 헤더 자가치유: login/signup/oauth/delete는 서버 redirect()로 끝나
    // (soft navigation) 클라 currentUser 쿼리가 갱신되지 않으면 헤더가 직전 상태로 남는다.
    // 매 navigation(경로 변경)마다 currentUser를 1회 refetch해 세션과 재동기화한다 —
    // 서버 렌더 시절 매 페이지 getCurrentUser와 동등한 비용이며, redirect 기반 인증
    // 플로우(클라 success hook 없음)에서도 헤더가 확실히 최신 상태를 반영한다. (경로 단위
    // ref 가드로 같은 경로 내 중복 refetch를 막는다.) 최초 마운트 시점엔 useCurrentUser가
    // 아직 enabled(isHydrated)=false라 이 refetchQueries는 no-op이 되고, hydration 후
    // 쿼리 자체 최초 fetch와 합쳐지므로 마운트 중복 요청은 발생하지 않는다.
    useEffect(() => {
        if (syncedPathRef.current === pathname) return;
        syncedPathRef.current = pathname;
        void queryClient.refetchQueries({
            queryKey: QUERY_KEYS.currentUser(),
        });
    }, [pathname, queryClient]);

    if (isPending) {
        // server action 확정 전: hint로 skeleton(로그인 추정) 또는 게스트 셸.
        return <Header currentUser={null} loadingUserMenu={hasHint} />;
    }

    const currentUser: HeaderUserMenuUser | null = user
        ? {
              email: user.email,
              name: user.name,
              tier: user.tier,
              avatarUrl: user.avatarUrl,
          }
        : null;
    return <Header currentUser={currentUser} />;
}
