'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { SITE_NAME } from '@/shared/lib/seo';
import { reportClientError } from '@/shared/lib/reportClientError';

interface NewsErrorProps {
    error: Error & { digest?: string };
    reset: () => void;
}

/**
 * Error boundary for the `/news` and `/news/[category]` subtree.
 *
 * `MarketNewsList` throws `pollError` when polling fails after the consecutive-
 * failure ceiling is reached. Without this boundary that error would propagate
 * to the root boundary — jarring UX for a recoverable polling failure.
 * `reset()` re-renders the segment so a transient outage can self-heal.
 */
export default function NewsError({ error, reset }: NewsErrorProps) {
    const t = useTranslations('app.news');
    useEffect(() => {
        console.error('[NewsRoute] render error:', error);
        reportClientError(error, 'NewsRoute', error.digest);
    }, [error]);

    return (
        <main className="flex flex-1 flex-col items-center px-6 py-20 text-center">
            <div role="alert" aria-atomic="true">
                <p className="font-mono text-sm tracking-widest text-primary-400">
                    {t('error.729779')}
                </p>
                <h1 className="mt-4 text-2xl font-bold text-secondary-100 sm:text-3xl">
                    {t('error.364c32')}
                </h1>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-secondary-400">
                    {t('error.1ead41')}
                </p>
            </div>
            <div className="mt-8 flex gap-3">
                <button
                    type="button"
                    onClick={reset}
                    className="inline-flex min-h-11 items-center rounded-lg bg-primary-600 px-6 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-950 focus-visible:outline-none"
                >
                    {t('error.0c767c')}
                </button>
                <Link
                    href="/"
                    className="inline-flex min-h-11 items-center rounded-lg px-6 text-sm font-medium text-secondary-200 transition-colors hover:text-secondary-50 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-950 focus-visible:outline-none"
                >
                    {t('error.eb2523', { v0: SITE_NAME })}
                </Link>
            </div>
        </main>
    );
}
