'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useCurrentLocale } from '@/shared/i18n/LocaleContext';
import { brandName } from '@/shared/lib/brandName';
import { reportClientError } from '@/shared/lib/reportClientError';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';

interface NewsErrorProps {
    /** `digest`는 서버 로그의 같은 에러 항목과 이 클라이언트 보고를 잇는다. */
    error: Error & { digest?: string };
    reset: () => void;
}

/**
 * `/news` 서브트리(허브·지역 허브·카테고리)의 에러 경계.
 *
 * `MarketNewsList`는 폴링이 연속 실패 상한에 닿으면 `pollError`를 던진다. 이 경계가 없으면
 * 회복 가능한 폴링 실패가 루트 경계까지 올라가 페이지 전체가 바뀐다. `reset()`은 세그먼트를
 * 다시 렌더해 일시 장애가 스스로 풀리게 한다. 메시지 묶음만 `role="alert"`로 알린다 —
 * 버튼·링크까지 넣으면 스크린리더가 조작 라벨까지 에러 문구로 읽는다.
 */
export default function NewsError({ error, reset }: NewsErrorProps) {
    const t = useTranslations('app.news');
    const locale = useCurrentLocale();
    useEffect(() => {
        console.error('[NewsRoute] render error:', error);
        reportClientError(error, 'NewsRoute', error.digest);
    }, [error]);

    return (
        <main className="page-container flex flex-1 flex-col items-center py-20 text-center">
            <div role="alert" aria-atomic="true">
                <p className="text-sm font-semibold tracking-[0.01em] text-primary-400">
                    {t('error.729779')}
                </p>
                <h1 className="mt-4 text-2xl font-bold text-secondary-50 sm:text-3xl">
                    {t('error.364c32')}
                </h1>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-secondary-400">
                    {t('error.1ead41')}
                </p>
            </div>
            <div className="mt-8 flex gap-3">
                <button
                    type="button"
                    onClick={reset}
                    className="inline-flex min-h-11 items-center rounded-lg bg-primary-600 px-6 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-950 focus-visible:outline-none"
                >
                    {t('error.0c767c')}
                </button>
                <Link
                    href="/"
                    className="inline-flex min-h-11 items-center rounded-lg px-6 text-sm font-medium text-secondary-200 transition-colors hover:text-secondary-50 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-950 focus-visible:outline-none"
                >
                    {t('error.eb2523', { v0: brandName(locale) })}
                </Link>
            </div>
        </main>
    );
}
