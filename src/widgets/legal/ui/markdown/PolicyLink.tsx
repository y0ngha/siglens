import type { ReactNode } from 'react';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { isInternalHref, opensInNewTab } from '../../utils/policyHref';

/** 약관 본문 링크의 공통 스타일(내부·외부 링크가 같은 모양이어야 한다). */
const POLICY_LINK_CLASS =
    'rounded text-primary-400 transition-colors hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-950 focus-visible:outline-none';

/** 새 탭 링크 속성. 열린 탭이 `window.opener`로 이 페이지를 조작하지 못하게 한다. */
const NEW_TAB_PROPS = { target: '_blank', rel: 'noopener noreferrer' } as const;

interface PolicyLinkProps {
    /** 마크다운 링크의 href. 비어 있을 수 있다. */
    readonly href: string | undefined;
    readonly children?: ReactNode;
}

/**
 * 약관 본문 마크다운의 `<a>` 렌더러.
 *
 * 내부 경로는 현재 로케일을 유지하도록 `LocaleLink`로, 외부 URL은 새 탭으로,
 * 메일·전화·문서 내 앵커는 같은 탭의 일반 `<a>`로 그린다.
 */
export function PolicyLink({ href, children }: PolicyLinkProps) {
    if (isInternalHref(href)) {
        return (
            <Link href={href} className={POLICY_LINK_CLASS}>
                {children}
            </Link>
        );
    }
    const tabProps = opensInNewTab(href) ? NEW_TAB_PROPS : undefined;
    return (
        <a href={href} className={POLICY_LINK_CLASS} {...tabProps}>
            {children}
        </a>
    );
}
