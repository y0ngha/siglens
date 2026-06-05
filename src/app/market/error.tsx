'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { SITE_NAME } from '@/shared/lib/seo';

interface MarketErrorProps {
    error: Error & { digest?: string };
    reset: () => void;
}

/**
 * Error boundary for the `/market` ISR route.
 *
 * `MarketContent` fans out to FMP (market summary / sector signals) + the
 * briefing peek. Those paths degrade gracefully today (core returns null quotes
 * / Promise.allSettled drops failures), so a thrown render is unlikely — but an
 * unexpected throw during an uncached ISR cold-gen (DB/Redis client init, an
 * unforeseen core error) would otherwise surface as a bare 500. This boundary
 * contains that into a branded, retryable UI. `reset()` re-renders the segment,
 * which on a transient outage typically succeeds on the next attempt. Mirrors
 * `src/app/[symbol]/error.tsx`.
 */
export default function MarketError({ error, reset }: MarketErrorProps) {
    useEffect(() => {
        // `digest` ties this client log to the server-side error entry.
        console.error('[MarketRoute] render error:', error);
    }, [error]);

    return (
        <main className="flex flex-1 flex-col items-center px-6 py-20 text-center">
            <p className="text-primary-400 font-mono text-sm tracking-widest">
                일시 오류
            </p>
            <h1 className="text-secondary-100 mt-4 text-2xl font-bold sm:text-3xl">
                시장 데이터를 불러오지 못했어요
            </h1>
            <p className="text-secondary-400 mt-3 max-w-md text-sm leading-relaxed">
                외부 시세 제공처가 일시적으로 응답하지 않을 수 있어요. 잠시 후
                다시 시도해 주세요.
            </p>
            <div className="mt-8 flex gap-3">
                <button
                    type="button"
                    onClick={reset}
                    className="bg-primary-600 hover:bg-primary-700 focus-visible:ring-primary-500 focus-visible:ring-offset-secondary-950 inline-flex min-h-11 items-center rounded-lg px-6 text-sm font-medium text-white transition-colors focus-visible:ring-1 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                    다시 시도
                </button>
                <Link
                    href="/"
                    className="text-secondary-200 hover:text-secondary-50 focus-visible:ring-primary-500 focus-visible:ring-offset-secondary-950 inline-flex min-h-11 items-center rounded-lg px-6 text-sm font-medium transition-colors focus-visible:ring-1 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                    {SITE_NAME} 홈으로
                </Link>
            </div>
        </main>
    );
}
