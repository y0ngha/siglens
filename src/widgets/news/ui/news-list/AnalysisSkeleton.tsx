'use client';

/**
 * AI 보강 전 카드의 배지 자리 표시.
 */
import { useTranslations } from 'next-intl';

/**
 * `aria-hidden`을 걸지 않는다 — 스크린리더가 로딩 상태를 읽도록 허용한다. 안내 문구의
 * `text-secondary-500`은 시장 뉴스 카드(`text-secondary-400`)와 의도적으로 다르다.
 */
export function AnalysisSkeleton() {
    const t = useTranslations('widgets.news');
    return (
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <div className="h-5 w-10 animate-pulse rounded bg-secondary-700 motion-reduce:animate-none" />
            <div className="h-5 w-20 animate-pulse rounded bg-secondary-700 motion-reduce:animate-none" />
            <span className="text-xs text-secondary-500">
                {t('NewsList.d12df8')}
            </span>
        </div>
    );
}
