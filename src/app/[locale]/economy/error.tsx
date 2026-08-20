'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { SITE_NAME } from '@/shared/lib/seo';
import { reportClientError } from '@/shared/lib/reportClientError';

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
 * Mirrors `src/app/market/error.tsx`.
 */
export default function EconomyError({ error, reset }: EconomyErrorProps) {
    const t = useTranslations('app.economy');
    useEffect(() => {
        // `digest` ties this client log to the server-side error entry.
        console.error('[EconomyRoute] render error:', error);
        reportClientError(error, 'EconomyRoute', error.digest);
    }, [error]);

    return (
        <main className="flex flex-1 flex-col items-center px-6 py-20 text-center">
            <p className="font-mono text-sm tracking-widest text-primary-400">
                {t('error.729779')}
            </p>
            <h1 className="mt-4 text-2xl font-bold text-secondary-100 sm:text-3xl">
                {t('error.250bba')}
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-secondary-400">
                {t('error.19cf82')}
            </p>
            <div className="mt-8 flex gap-3">
                <button
                    type="button"
                    onClick={reset}
                    className="inline-flex min-h-11 items-center rounded-lg bg-primary-600 px-6 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-950 focus-visible:outline-none"
                >
                    {t('error.0c767c')}
                </button>
                <Link
                    href="/"
                    className="inline-flex min-h-11 items-center rounded-lg px-6 text-sm font-medium text-secondary-200 transition-colors hover:text-secondary-50 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-950 focus-visible:outline-none"
                >
                    {t('error.eb2523', { v0: SITE_NAME })}
                </Link>
            </div>
        </main>
    );
}
