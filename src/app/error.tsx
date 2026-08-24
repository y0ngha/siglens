'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { SITE_NAME } from '@/shared/lib/seo';
import { reportClientError } from '@/shared/lib/reportClientError';

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
    useEffect(() => {
        // `digest` ties this client log to the server-side error entry.
        console.error('[RootRoute] render error:', error);
        reportClientError(error, 'RootRoute', error.digest);
    }, [error]);

    return (
        <main className="flex flex-1 flex-col items-center px-6 py-20 text-center">
            <p className="text-sm font-semibold tracking-[0.01em] text-primary-400">
                일시 오류
            </p>
            <h1 className="mt-4 text-2xl font-bold text-secondary-100 sm:text-3xl">
                페이지를 불러오지 못했어요
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-secondary-400">
                일시적인 문제가 발생했어요. 잠시 후 다시 시도해 주세요.
            </p>
            <div className="mt-8 flex gap-3">
                <button
                    type="button"
                    onClick={reset}
                    className="inline-flex min-h-11 items-center rounded-lg bg-primary-600 px-6 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-950 focus-visible:outline-none"
                >
                    다시 시도
                </button>
                <Link
                    href="/"
                    className="inline-flex min-h-11 items-center rounded-lg px-6 text-sm font-medium text-secondary-200 transition-colors hover:text-secondary-50 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-950 focus-visible:outline-none"
                >
                    {SITE_NAME} 홈으로
                </Link>
            </div>
        </main>
    );
}
