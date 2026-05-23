import { Suspense } from 'react';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { Header } from '@/components/layout/Header';
import type { HeaderUserMenuUser } from '@/components/layout/HeaderUserMenu';
import { getCurrentUser } from '@/infrastructure/auth/getCurrentUser';
import { AUTH_HINT_COOKIE_NAME } from '@/lib/auth/cookieNames';

/**
 * cookies()/DB-세션 조회를 root layout 밖으로 격리한 Server Component.
 *
 * Root layout이 cookies()를 직접 호출하면 Next.js가 모든 라우트를 dynamic
 * 렌더링으로 강제해 정적 캐시(`x-vercel-cache: HIT`)가 불가능해진다.
 * 이 컴포넌트를 <Suspense>로 감싸 layout 자체는 static-eligible 상태를
 * 유지하면서, header만 per-request로 hydration 되도록 한다.
 *
 * 두 단계 Suspense로 header flash를 원천 제거한다.
 *
 * 1단계(AuthSessionHeader 본체): hint 쿠키만 읽는다 — I/O 없음, 거의 즉시 완료.
 *    → 쿠키 있음: 내부 fallback을 skeleton으로 설정 (로그인 상태 힌트)
 *    → 쿠키 없음: 내부 fallback을 로그인/회원가입으로 설정 (이미 정답, flash 없음)
 *
 * 2단계(HeaderWithUser): DB 세션 조회 — blocking 작업이므로 Suspense 안에 격리.
 *    → 완료 후 실제 auth 상태로 교체.
 *
 * 외부 Suspense(layout.tsx의 skeleton)는 hint 쿠키 읽기가 완료될 때까지만
 * 표시되며 cookies()는 메모리 조회라 실질적으로 비가시 구간이다.
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
