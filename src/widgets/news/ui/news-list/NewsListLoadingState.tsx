'use client';

/**
 * 첫 폴링 응답을 기다리는 동안의 뉴스 목록 — 제목, 수집 중 안내, 카드 스켈레톤 3장.
 */
import { useTranslations } from 'next-intl';
import { NewsCardSkeleton } from './NewsCardSkeleton';
import { NewsListHeading } from './NewsListHeading';

const NEWS_LIST_SKELETON_COUNT = 3;

/** `aria-busy` 섹션과 `aria-live` 안내 문구를 가진 로딩 화면. */
export function NewsListLoadingState() {
    const t = useTranslations('widgets.news');
    return (
        <section
            aria-labelledby="news-list-heading"
            aria-busy="true"
            className="w-full max-w-full min-w-0 space-y-3 overflow-hidden"
        >
            <div className="flex items-center justify-between gap-3">
                <NewsListHeading />
                <span className="text-xs text-secondary-400" aria-live="polite">
                    {t('NewsList.b514aa')}
                </span>
            </div>
            <ul className="space-y-3">
                {Array.from({ length: NEWS_LIST_SKELETON_COUNT }).map(
                    (_, i) => (
                        <li key={i}>
                            <NewsCardSkeleton />
                        </li>
                    )
                )}
            </ul>
        </section>
    );
}
