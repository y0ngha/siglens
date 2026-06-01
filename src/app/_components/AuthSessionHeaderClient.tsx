'use client';

import { Header } from '@/widgets/layout/Header';
import type { HeaderUserMenuUser } from '@/widgets/layout/HeaderUserMenu';
import { useCurrentUser, useAuthHint } from '@/entities/session';

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
    const hasHint = useAuthHint();
    const { data: user, isPending } = useCurrentUser();

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
