'use client';

import { useTranslations } from 'next-intl';
import { SITE_NAME } from '@/shared/lib/seo';
import { RouteErrorView } from '@/app/_components/RouteErrorView';

interface FearGreedErrorProps {
    error: Error & { digest?: string };
    reset: () => void;
}

/**
 * Error boundary for the `/fear-greed` ISR route.
 *
 * `getMarketFearGreedStatic` already degrades gracefully (page-level `.catch`
 * falls back to an empty snapshot), so a thrown render here would only come
 * from an unexpected client/render bug rather than the usual FMP/Redis
 * flakiness. This boundary still contains that into a branded, retryable UI
 * instead of a bare 500. `reset()` re-renders the segment.
 */
export default function FearGreedError({ error, reset }: FearGreedErrorProps) {
    const t = useTranslations('app.fear-greed');
    return (
        <RouteErrorView
            error={error}
            reset={reset}
            logTag="FearGreedRoute"
            eyebrow={t('error.729779')}
            title={t('error.e533f3')}
            body={t('error.4749c9')}
            retryLabel={t('error.0c767c')}
            homeLabel={t('error.eb2523', { v0: SITE_NAME })}
        />
    );
}
