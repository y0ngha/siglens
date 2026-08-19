'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { SITE_NAME } from '@/shared/lib/seo';

interface RootErrorProps {
    error: Error & { digest?: string };
    reset: () => void;
}

/**
 * Root error boundary — covers `/`, `/backtesting`, `/privacy`, `/terms`,
 * `/account*`, `/signup*`, `/forgot-password`, `/reset-password`.
 *
 * Sits one level above route-specific boundaries (market/error.tsx,
 * economy/error.tsx). Catches interactive client-side throws that escape
 * those nested boundaries and presents a branded, retryable UI instead of
 * a blank page. `reset()` re-renders the failed segment in place.
 *
 * Mirrors `src/app/market/error.tsx` structure and styling.
 */
export default function RootError({ error, reset }: RootErrorProps) {
    const t = useTranslations('app.home');
    useEffect(() => {
        // `digest` ties this client log to the server-side error entry.
        console.error('[RootRoute] render error:', error);
    }, [error]);

    return (
        <main className="flex flex-1 flex-col items-center px-6 py-20 text-center">
            <p className="font-mono text-sm tracking-widest text-primary-400">
                {t('error.729779')}
            </p>
            <h1 className="mt-4 text-2xl font-bold text-secondary-100 sm:text-3xl">
                {t('error.80dac7')}
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-secondary-400">
                {t('error.32c8a0')}
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
                    {SITE_NAME} {t('error.d8c261')}
                </Link>
            </div>
        </main>
    );
}
