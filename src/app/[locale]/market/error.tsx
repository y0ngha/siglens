'use client';

import { useTranslations } from 'next-intl';
import { useCurrentLocale } from '@/shared/i18n/LocaleContext';
import { brandName } from '@/shared/lib/brandName';
import { RouteErrorView } from '@/app/_components/RouteErrorView';

interface MarketErrorProps {
    error: Error & { digest?: string };
    reset: () => void;
}

/**
 * Error boundary for the `/market` ISR route.
 *
 * `MarketContent` fans out to FMP (market summary / sector signals) + the
 * briefing peek. Those paths degrade gracefully today (core returns null quotes
 * / Promise.allSettled drops failures), so a thrown render is unlikely — but an
 * unexpected throw during an uncached ISR cold-gen (DB/Redis client init, an
 * unforeseen core error) would otherwise surface as a bare 500. This boundary
 * contains that into a branded, retryable UI. `reset()` re-renders the segment,
 * which on a transient outage typically succeeds on the next attempt.
 */
export default function MarketError({ error, reset }: MarketErrorProps) {
    const t = useTranslations('app.market');
    const locale = useCurrentLocale();
    return (
        <RouteErrorView
            error={error}
            reset={reset}
            logTag="MarketRoute"
            eyebrow={t('error.729779')}
            title={t('error.cccc8a')}
            body={t('error.a92ddb')}
            retryLabel={t('error.0c767c')}
            homeLabel={t('error.eb2523', { v0: brandName(locale) })}
        />
    );
}
