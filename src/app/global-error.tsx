'use client';

// global-error.tsx는 루트 레이아웃을 완전히 교체하므로, 루트 레이아웃이 담당하던
// globals.css 로드를 이 파일이 직접 맡는다. 없으면 Tailwind 클래스가 해석되지 않는다.
import './globals.css';
import { useEffect } from 'react';
import Link from 'next/link';
import { reportClientError } from '@/shared/lib/reportClientError';

interface GlobalErrorProps {
    error: Error & { digest?: string };
    reset: () => void;
}

/**
 * Global error boundary — replaces the root layout on a root-level throw.
 *
 * Because it replaces the root layout entirely, it MUST render its own
 * `<html>` and `<body>` tags AND import the global stylesheet itself —
 * the root layout (which normally imports globals.css) is bypassed, so
 * Tailwind classes would not resolve without this import.
 *
 * Kept dependency-light: no app providers, no shared/ui imports that pull
 * in layout-level CSS-in-JS or context. Mirrors `src/app/error.tsx`'s
 * visual pattern using Tailwind classes with design tokens.
 *
 * `reset()` retriggers a render of the root segment which typically
 * recovers from transient throws (Redis/DB client init, cold-gen errors).
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
    useEffect(() => {
        console.error('[GlobalError] root layout error:', error);
        reportClientError(error, 'GlobalError', error.digest);
    }, [error]);

    return (
        <html lang="ko">
            <body className="flex min-h-dvh flex-col items-center justify-center bg-secondary-900 px-6 text-center text-secondary-50">
                <p className="font-mono text-xs tracking-widest text-primary-400 uppercase">
                    일시 오류
                </p>
                <h1 className="mt-4 text-2xl font-bold text-secondary-100">
                    서비스를 불러오지 못했어요
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
                        홈으로
                    </Link>
                </div>
            </body>
        </html>
    );
}
