'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { SITE_NAME } from '@/shared/lib/seo';

interface ShareErrorProps {
    error: Error & { digest?: string };
    reset: () => void;
}

/**
 * Error boundary for the `/share/[id]` subtree.
 *
 * Any uncaught render error inside the share page — e.g. an unexpected
 * snapshot shape or a rendering failure in a kind panel — degrades to this
 * branded screen instead of the generic root error.
 */
export default function ShareError({ error, reset }: ShareErrorProps) {
    useEffect(() => {
        console.error('[ShareRoute] render error:', error);
    }, [error]);

    return (
        <main className="flex flex-1 flex-col items-center px-6 py-20 text-center">
            <p className="text-primary-400 font-mono text-sm tracking-widest">
                일시 오류
            </p>
            <h1 className="text-secondary-100 mt-4 text-2xl font-bold sm:text-3xl">
                공유 페이지를 불러오지 못했어요
            </h1>
            <p className="text-secondary-400 mt-3 max-w-md text-sm leading-relaxed">
                일시적인 오류가 발생했어요. 잠시 후 다시 시도하거나 {SITE_NAME}{' '}
                홈에서 직접 분석을 확인해 주세요.
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
