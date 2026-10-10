'use client';

import { useTranslations } from 'next-intl';
import { useCurrentLocale } from '@/shared/i18n/LocaleContext';
import { brandName } from '@/shared/lib/brandName';
import { RouteErrorView } from '@/app/_components/RouteErrorView';

interface EconomyErrorProps {
    error: Error & { digest?: string };
    reset: () => void;
}

/**
 * Error boundary for the `/economy` ISR route.
 *
 * `EconomicCalendarGrid` and related widgets degrade gracefully in most cases,
 * but an unexpected throw during an uncached ISR cold-gen (DB/Redis client init,
 * unforeseen core error) would surface as a bare 500 without this boundary.
 * `reset()` re-renders the segment, which typically succeeds on a transient outage.
 */
export default function EconomyError({ error, reset }: EconomyErrorProps) {
    const t = useTranslations('app.economy');
    const locale = useCurrentLocale();
    return (
        <RouteErrorView
            error={error}
            reset={reset}
            logTag="EconomyRoute"
            eyebrow={t('error.729779')}
            title={t('error.250bba')}
            body={t('error.19cf82')}
            retryLabel={t('error.0c767c')}
            homeLabel={t('error.eb2523', { v0: brandName(locale) })}
        />
    );
}
