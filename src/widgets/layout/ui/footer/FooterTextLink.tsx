import type { ReactNode } from 'react';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { FOOTER_LINK_CLASSES } from './footerLinkStyles';

interface FooterTextLinkProps {
    readonly href: string;
    readonly children: ReactNode;
}

/**
 * 푸터의 사이트 내부 텍스트 링크.
 *
 * 모든 페이지에 렌더되는 전역 링크라 `prefetch`를 끈다 — 진입 페이지마다 다른 `_rsc` 해시가
 * CDN 캐시를 파편화시킨다.
 */
export function FooterTextLink({ href, children }: FooterTextLinkProps) {
    return (
        <Link href={href} prefetch={false} className={FOOTER_LINK_CLASSES}>
            {children}
        </Link>
    );
}
