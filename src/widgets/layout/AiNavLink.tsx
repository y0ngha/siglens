'use client';

import { AI_SITE_URL } from '@/shared/config/aiHost';
import { useCurrentLocale, useHrefBase } from '@/shared/i18n/LocaleContext';
import { localePath } from '@/shared/i18n/locales';
import { cn } from '@/shared/lib/cn';

interface Props {
    readonly className?: string;
    readonly tabIndex?: number;
}

/**
 * Entry point to ai.siglens.io from the main header and the mobile drawer.
 * A plain `<a>` on purpose: it is a different origin, so `LocaleLink`'s
 * client-side routing has nothing to do here. On the ai host itself the same
 * header is rendered with a link base set (`useHrefBase() !== ''`), which is
 * how the link knows to show itself as the current page.
 */
export function AiNavLink({ className, tabIndex }: Props) {
    const locale = useCurrentLocale();
    const onAiHost = useHrefBase() !== '';
    const href = `${AI_SITE_URL}${localePath(locale, '/')}`;
    return (
        <a
            href={href}
            translate="no"
            aria-current={onAiHost ? 'page' : undefined}
            tabIndex={tabIndex}
            className={cn(
                'inline-flex min-h-11 items-center rounded-full border border-border-control px-3 text-sm font-medium text-primary-300 hover:bg-secondary-800 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none',
                onAiHost && 'bg-secondary-800 text-secondary-100',
                className
            )}
        >
            SiglensAI
        </a>
    );
}
