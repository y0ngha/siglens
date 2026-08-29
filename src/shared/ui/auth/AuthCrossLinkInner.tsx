'use client';

import type { ReactNode } from 'react';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { useSearchParams } from 'next/navigation';

import { sanitizeNextPath } from '@/shared/lib/auth/redirect';

interface AuthCrossLinkInnerProps {
    href: string;
    className?: string;
    children: ReactNode;
}

/**
 * `AuthCrossLink`의 클라이언트 절반. 경계는 그쪽이 갖는다.
 *
 * `sanitizeNextPath`를 반드시 거친다 — 이 값은 URL에서 오고 그대로 링크에
 * 실리므로, 정제하지 않으면 `//evil.com` 같은 형태가 다음 화면의 폼으로
 * 그대로 전달된다. `'/'`(기본값)는 붙일 이유가 없으므로 생략한다.
 */
export function AuthCrossLinkInner({
    href,
    className,
    children,
}: AuthCrossLinkInnerProps) {
    const next = sanitizeNextPath(useSearchParams().get('next'));
    const target =
        next === '/' ? href : `${href}?next=${encodeURIComponent(next)}`;
    return (
        <Link href={target} className={className}>
            {children}
        </Link>
    );
}
