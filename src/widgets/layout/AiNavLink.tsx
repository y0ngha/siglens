'use client';

import { AI_SITE_URL } from '@/shared/config/aiHost';
import { useCurrentLocale, useHrefBase } from '@/shared/i18n/LocaleContext';
import { localePath } from '@/shared/i18n/locales';
import { cn } from '@/shared/lib/cn';

interface Props {
    readonly className?: string;
    readonly tabIndex?: number;
    /**
     * `wordmark` — the "AI" half of the `SIGLENS AI` logo lockup in the header
     * (same mono/tracking grammar as the wordmark, brand colour). `pill` — the
     * labelled entry in the mobile drawer.
     */
    readonly variant?: 'pill' | 'wordmark';
}

/** Where the AI product lives for the current locale — shared by the lockup and the drawer entry. */
export function useAiHomeHref(): string {
    const locale = useCurrentLocale();
    return `${AI_SITE_URL}${localePath(locale, '/')}`;
}

/**
 * Entry point to ai.siglens.io. A plain `<a>` on purpose: it is a different
 * origin, so `LocaleLink`'s client-side routing has nothing to do here. On
 * the ai host itself the same header is rendered with a link base set
 * (`useHrefBase() !== ''`), which is how the link knows to show itself as the
 * current page.
 *
 * The accessible name is always "SiglensAI" — the wordmark variant only
 * *shows* "AI" (the "SIGLENS" half is the logo right next to it), so the
 * label restores the full product name for assistive tech and the E2E suite.
 */
export function AiNavLink({ className, tabIndex, variant = 'pill' }: Props) {
    const onAiHost = useHrefBase() !== '';
    const href = useAiHomeHref();
    if (variant === 'wordmark') {
        return (
            <a
                href={href}
                translate="no"
                aria-label="SiglensAI"
                aria-current={onAiHost ? 'page' : undefined}
                tabIndex={tabIndex}
                className={cn(
                    'inline-flex min-h-11 items-center rounded px-1 font-mono text-sm font-semibold tracking-[0.15em] text-primary-400 uppercase hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none',
                    className
                )}
            >
                AI
            </a>
        );
    }
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
