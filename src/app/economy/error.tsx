'use client';

import { useEffect } from 'react';
import Link from 'next/link';
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
    useEffect(() => {
        // `digest` ties this client log to the server-side error entry.
        console.error('[EconomyRoute] render error:', error);
        reportClientError(error, 'EconomyRoute', error.digest);
    }, [error]);

    return (
        <main className="flex flex-1 flex-col items-center px-6 py-20 text-center">
            <p className="text-sm font-semibold tracking-[0.01em] text-primary-400">
                일시 오류
            </p>
            <h1 className="mt-4 text-2xl font-bold text-secondary-100 sm:text-3xl">
                경제 캘린더를 불러오지 못했어요
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-secondary-400">
                경제 일정 데이터를 가져오는 중 일시적인 오류가 생겼어요. 잠시 후
                다시 시도해 주세요.
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
