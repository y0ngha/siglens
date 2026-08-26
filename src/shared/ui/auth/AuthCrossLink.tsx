import { Suspense, type ReactNode } from 'react';
import Link from 'next/link';

import { AuthCrossLinkInner } from './AuthCrossLinkInner';

interface AuthCrossLinkProps {
    /** 목적지 경로. `next`가 있으면 쿼리로 이어 붙는다. */
    href: string;
    className?: string;
    children: ReactNode;
}

/**
 * 로그인 ↔ 회원가입을 오갈 때 `next`를 잃지 않는 링크.
 *
 * 인증 게이트는 `/login?next=/portfolio` 형태로 돌려보낸다. 그 화면의 폼과
 * OAuth 버튼은 `next`를 제대로 실어 나르는데, "처음이세요? 회원가입 →" 링크만
 * `href="/signup"` 리터럴이라 돌아갈 곳이 거기서 끊겼다(감사 실측:
 * `/login?next=%2Fportfolio`에서 hidden input과 OAuth href에는 `next`가 있는데
 * 푸터 링크에는 없다). 가입을 마친 사용자는 원래 가려던 페이지 대신 기본
 * 목적지로 떨어진다 — 잠금 해제 경로가 가입인 제품에서 특히 아프다.
 *
 * 푸터는 서버 페이지가 prop으로 넘기고 `next`는 클라이언트에서만 읽을 수 있어,
 * 페이지 구조를 바꾸지 않도록 이 컴포넌트가 자기 Suspense 경계를 들고 다닌다.
 * 폴백은 `next` 없는 평범한 링크라 하이드레이션 전에도 동작한다.
 */
export function AuthCrossLink({
    href,
    className,
    children,
}: AuthCrossLinkProps) {
    return (
        <Suspense
            fallback={
                <Link href={href} className={className}>
                    {children}
                </Link>
            }
        >
            <AuthCrossLinkInner href={href} className={className}>
                {children}
            </AuthCrossLinkInner>
        </Suspense>
    );
}
