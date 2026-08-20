'use client';
/* eslint-disable nextjs/no-html-link-for-pages --
 * 아래 홈 링크는 `<Link>`가 아니라 `<a>`여야 한다. 이 파일은 루트 레이아웃이
 * 죽은 뒤 렌더되므로, 클라이언트 라우팅으로 홈에 가면 방금 터진 바로 그 트리로
 * 되돌아간다. 전체 페이지 로드로 앱을 처음부터 다시 세우는 것이 유일하게
 * 복구되는 경로다. */

// global-error.tsx는 루트 레이아웃을 완전히 교체하므로, 루트 레이아웃이 담당하던
// globals.css 로드를 이 파일이 직접 맡는다. 없으면 Tailwind 클래스가 해석되지 않는다.
import './globals.css';
import { useEffect } from 'react';
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
 * ⚠️ **여기서는 `useTranslations`를 쓸 수 없다.** 이 파일은 루트 레이아웃을
 * 대체하므로 `NextIntlClientProvider`가 트리에 없고, `use-intl`은 컨텍스트가
 * null이면 던진다 — 최후의 에러 경계가 그 자체로 죽어 `reset()`에 도달할 수
 * 없게 된다. 로케일도 알 수 없으므로(레이아웃이 없어 `[locale]` 세그먼트가
 * 해석되지 않았다) 한국어·영어를 병기한 정적 문구를 쓴다. 링크도 `LocaleLink`가
 * 아니라 맨 `<a>`다 — 깨진 루트에서는 전체 페이지 로드가 오히려 복구에 낫다.
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
                    ERROR
                </p>
                <h1 className="mt-4 text-2xl font-bold text-secondary-100">
                    문제가 발생했습니다
                    <span className="mt-1 block text-lg font-medium text-secondary-300">
                        Something went wrong
                    </span>
                </h1>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-secondary-400">
                    페이지를 불러오지 못했습니다. 다시 시도해 주세요.
                    <span className="mt-1 block">
                        We couldn’t load this page. Please try again.
                    </span>
                </p>
                <div className="mt-8 flex gap-3">
                    <button
                        type="button"
                        onClick={reset}
                        className="inline-flex min-h-11 items-center rounded-lg bg-primary-600 px-6 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-950 focus-visible:outline-none"
                    >
                        다시 시도 / Retry
                    </button>
                    <a
                        href="/"
                        className="inline-flex min-h-11 items-center rounded-lg px-6 text-sm font-medium text-secondary-200 transition-colors hover:text-secondary-50 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-950 focus-visible:outline-none"
                    >
                        홈으로 / Home
                    </a>
                </div>
            </body>
        </html>
    );
}
