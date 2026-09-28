'use client';

import { useEffect } from 'react';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { reportClientError } from '@/shared/lib/reportClientError';

export interface RouteErrorViewProps {
    error: Error & { digest?: string };
    reset: () => void;
    /** 콘솔 접두사이자 `reportClientError` 태그(예: `MarketRoute`). */
    logTag: string;
    eyebrow: string;
    title: string;
    body: string;
    retryLabel: string;
    homeLabel: string;
    /** 본문 폭 컨테이너. 종목 라우트만 `symbol-container`를 쓴다. */
    containerClassName?: 'page-container' | 'symbol-container';
}

/**
 * 라우트 `error.tsx`들이 공유하는 브랜드 에러 화면 — 재시도(`reset()`) + 홈 링크.
 *
 * **문구는 이미 번역된 문자열로 받는다.** i18n 추출기는 번역기(`useTranslations`)를
 * 선언한 파일의 `t('리터럴')`만 수집하므로, `t()` 호출은 각 `error.tsx`에 남기고 여기로
 * 옮기지 않는다 — 옮기면 그 라우트의 클라이언트 메시지 번들에서 키가 빠진다.
 */
export function RouteErrorView({
    error,
    reset,
    logTag,
    eyebrow,
    title,
    body,
    retryLabel,
    homeLabel,
    containerClassName = 'page-container',
}: RouteErrorViewProps) {
    useEffect(() => {
        // `digest` ties this client log to the server-side error entry.
        console.error(`[${logTag}] render error:`, error);
        reportClientError(error, logTag, error.digest);
    }, [error, logTag]);

    return (
        <main
            className={`${containerClassName} flex flex-1 flex-col items-center py-20 text-center`}
        >
            {/*
             * 메시지 묶음만 alert로 알린다 — 버튼·링크까지 넣으면 스크린리더가 조작
             * 라벨까지 에러 문구로 읽는다(news/error.tsx와 같은 배치). 래퍼가 flex
             * 아이템이 되면서 가운데 정렬이 끊기지 않게 안에서 다시 세로 정렬한다.
             */}
            <div
                role="alert"
                aria-atomic="true"
                className="flex flex-col items-center"
            >
                <p className="text-sm font-semibold tracking-[0.01em] text-primary-400">
                    {eyebrow}
                </p>
                <h1 className="mt-4 text-2xl font-bold text-secondary-50 sm:text-3xl">
                    {title}
                </h1>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-secondary-400">
                    {body}
                </p>
            </div>
            <div className="mt-8 flex gap-3">
                <button
                    type="button"
                    onClick={reset}
                    className="inline-flex min-h-11 items-center rounded-lg bg-primary-600 px-6 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-950 focus-visible:outline-none"
                >
                    {retryLabel}
                </button>
                <Link
                    href="/"
                    className="inline-flex min-h-11 items-center rounded-lg px-6 text-sm font-medium text-secondary-200 transition-colors hover:text-secondary-50 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-950 focus-visible:outline-none"
                >
                    {homeLabel}
                </Link>
            </div>
        </main>
    );
}
