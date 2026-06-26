'use client';

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
 * `<html>` and `<body>` tags. Kept dependency-light: no app providers,
 * no shared/ui imports that pull in layout-level CSS-in-JS or context.
 * Mirrors the visual style of `src/app/market/error.tsx` using inline
 * Tailwind classes that match the design system.
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
            <body
                style={{
                    margin: 0,
                    backgroundColor: '#0a0a0f',
                    color: '#e2e8f0',
                    fontFamily:
                        'ui-sans-serif, system-ui, -apple-system, sans-serif',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '100dvh',
                    padding: '1.5rem',
                    textAlign: 'center',
                }}
            >
                <p
                    style={{
                        fontFamily: 'ui-monospace, monospace',
                        fontSize: '0.75rem',
                        letterSpacing: '0.15em',
                        color: '#818cf8',
                        textTransform: 'uppercase',
                    }}
                >
                    일시 오류
                </p>
                <h1
                    style={{
                        marginTop: '1rem',
                        fontSize: '1.5rem',
                        fontWeight: 700,
                        color: '#f1f5f9',
                    }}
                >
                    서비스를 불러오지 못했어요
                </h1>
                <p
                    style={{
                        marginTop: '0.75rem',
                        maxWidth: '28rem',
                        fontSize: '0.875rem',
                        lineHeight: 1.6,
                        color: '#94a3b8',
                    }}
                >
                    일시적인 문제가 발생했어요. 잠시 후 다시 시도해 주세요.
                </p>
                <div
                    style={{
                        marginTop: '2rem',
                        display: 'flex',
                        gap: '0.75rem',
                    }}
                >
                    <button
                        type="button"
                        onClick={reset}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            minHeight: '2.75rem',
                            padding: '0 1.5rem',
                            borderRadius: '0.5rem',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            color: '#fff',
                            background: '#4f46e5',
                            border: 'none',
                            cursor: 'pointer',
                        }}
                    >
                        다시 시도
                    </button>
                    <Link
                        href="/"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            minHeight: '2.75rem',
                            padding: '0 1.5rem',
                            borderRadius: '0.5rem',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            color: '#e2e8f0',
                            textDecoration: 'none',
                        }}
                    >
                        홈으로
                    </Link>
                </div>
            </body>
        </html>
    );
}
