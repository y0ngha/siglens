'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { SITE_NAME } from '@/shared/lib/seo';

interface SymbolErrorProps {
    error: Error & { digest?: string };
    reset: () => void;
}

/**
 * Error boundary for the whole `[symbol]` subtree (chart / fundamental / news /
 * options / fear-greed / overall).
 *
 * These routes fan out to external providers (FMP / Yahoo / LLM). Most call
 * sites degrade gracefully, but any uncaught throw during render — e.g. an FMP
 * infra failure on a cold ISR cache — would otherwise surface as a bare 500.
 * This boundary contains that into a branded, retryable UI. `reset()` re-renders
 * the segment (a fresh attempt, which on transient outages will often succeed).
 */
export default function SymbolError({ error, reset }: SymbolErrorProps) {
    const t = useTranslations('app.symbol');
    useEffect(() => {
        // `digest` ties this client log to the server-side error entry.
        console.error('[SymbolRoute] render error:', error);
    }, [error]);

    return (
        <main className="flex flex-1 flex-col items-center px-6 py-20 text-center">
            <p className="font-mono text-sm tracking-widest text-primary-400">
                {t('error.729779')}
            </p>
            <h1 className="mt-4 text-2xl font-bold text-secondary-100 sm:text-3xl">
                {t('error.0de4f6')}
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-secondary-400">
                {t('error.2e23eb')}
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
