import { Suspense } from 'react';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { Header } from '@/components/layout/Header';
import type { HeaderUserMenuUser } from '@/components/layout/HeaderUserMenu';
import { getCurrentUser } from '@/entities/session';
import { AUTH_HINT_COOKIE_NAME } from '@/shared/config/cookieNames';

/**
 * cookies()/DB-세션 조회를 root layout 밖으로 격리한 Server Component.
 *
 * Root layout이 cookies()를 직접 호출하면 Next.js가 모든 라우트를 dynamic
 * 렌더링으로 강제해 정적 캐시(`x-vercel-cache: HIT`)가 불가능해진다.
 * 이 컴포넌트를 <Suspense>로 감싸 layout 자체는 static-eligible 상태를
 * 유지하면서, header만 per-request로 hydration 되도록 한다.
 *
 * 두 단계 Suspense로 **내부 fallback flash**(skeleton → 잘못 추정한 상태 →
 * 정답으로 교체되는 깜빡임)를 제거한다. 외부 fallback(layout.tsx의 skeleton)은
 * 정적 셸에 포함되어 게스트·로그인 사용자 모두에게 한 번 보였다가 본 컴포넌트
 * 결과로 교체된다 — 이 부분은 PPR 셸 구조상 불가피한 1회 swap이다.
 *
 * 1단계(AuthSessionHeader 본체): hint 쿠키만 읽는다 — I/O 없음, 거의 즉시 완료.
 *    → 쿠키 있음: 내부 fallback을 skeleton(로그인 상태 추정)으로 설정
 *    → 쿠키 없음: 내부 fallback을 로그인/회원가입 CTA로 설정 (이미 정답, 내부 flash 없음)
 *
 * 2단계(HeaderWithUser): DB 세션 조회 — blocking 작업이므로 Suspense 안에 격리.
 *    → 완료 후 실제 auth 상태로 교체.
 */
export async function AuthSessionHeader(): Promise<ReactNode> {
    const cookieStore = await cookies();
    const hasSession = !!cookieStore.get(AUTH_HINT_COOKIE_NAME)?.value;
    return (
        <Suspense
            fallback={
                <Header currentUser={null} loadingUserMenu={hasSession} />
            }
        >
            <HeaderWithUser />
        </Suspense>
    );
}

async function HeaderWithUser(): Promise<ReactNode> {
    const authUser = await getCurrentUser();
    const currentUser: HeaderUserMenuUser | null = authUser
        ? {
              email: authUser.email,
              name: authUser.name,
              tier: authUser.tier,
              avatarUrl: authUser.avatarUrl,
          }
        : null;
    return <Header currentUser={currentUser} />;
}
