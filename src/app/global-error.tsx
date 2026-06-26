'use client';

// global-error.tsx는 루트 레이아웃을 완전히 교체하므로, 루트 레이아웃이 담당하던
// globals.css 로드를 이 파일이 직접 맡는다. 없으면 Tailwind 클래스가 해석되지 않는다.
import './globals.css';
import { useEffect } from 'react';
import Link from 'next/link';

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
    }, [error]);

    return (
        <html lang="ko">
            <body className="bg-secondary-900 text-secondary-50 flex min-h-dvh flex-col items-center justify-center px-6 text-center">
                <p className="text-primary-400 font-mono text-xs tracking-widest uppercase">
                    일시 오류
                </p>
                <h1 className="text-secondary-100 mt-4 text-2xl font-bold">
                    서비스를 불러오지 못했어요
                </h1>
                <p className="text-secondary-400 mt-3 max-w-md text-sm leading-relaxed">
                    일시적인 문제가 발생했어요. 잠시 후 다시 시도해 주세요.
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
                        홈으로
                    </Link>
                </div>
            </body>
        </html>
    );
}
