'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { SITE_NAME } from '@/shared/lib/seo';

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
 * instead of a bare 500. `reset()` re-renders the segment. Mirrors
 * `src/app/market/error.tsx`.
 */
export default function FearGreedError({ error, reset }: FearGreedErrorProps) {
    const t = useTranslations('app.fear-greed');
    useEffect(() => {
        // `digest` ties this client log to the server-side error entry.
        console.error('[FearGreedRoute] render error:', error);
    }, [error]);

    return (
        <main className="flex flex-1 flex-col items-center px-6 py-20 text-center">
            <p className="font-mono text-sm tracking-widest text-primary-400">
                {t('error.729779')}
            </p>
            <h1 className="mt-4 text-2xl font-bold text-secondary-100 sm:text-3xl">
                {t('error.e533f3')}
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-secondary-400">
                {t('error.4749c9')}
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
