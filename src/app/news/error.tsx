'use client';

import { useEffect } from 'react';
import Link from 'next/link';
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
    useEffect(() => {
        console.error('[NewsRoute] render error:', error);
        reportClientError(error, 'NewsRoute', error.digest);
    }, [error]);

    return (
        <main className="flex flex-1 flex-col items-center px-6 py-20 text-center">
            <div role="alert" aria-atomic="true">
                <p className="font-mono text-sm tracking-widest text-primary-400">
                    일시 오류
                </p>
                <h1 className="mt-4 text-2xl font-bold text-secondary-100 sm:text-3xl">
                    시장 뉴스를 불러오는 중에 문제가 발생했어요.
                </h1>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-secondary-400">
                    뉴스 데이터를 가져오는 중 일시적인 오류가 생겼어요. 잠시 후
                    다시 시도해 주세요.
                </p>
            </div>
            <div className="mt-8 flex gap-3">
                <button
                    type="button"
                    onClick={reset}
                    className="inline-flex min-h-11 items-center rounded-lg bg-primary-600 px-6 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-950 focus-visible:outline-none"
                >
                    다시 시도
                </button>
                <Link
                    href="/"
                    className="inline-flex min-h-11 items-center rounded-lg px-6 text-sm font-medium text-secondary-200 transition-colors hover:text-secondary-50 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-950 focus-visible:outline-none"
                >
                    {SITE_NAME} 홈으로
                </Link>
            </div>
        </main>
    );
}
