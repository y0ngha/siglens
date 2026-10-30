'use client';

/**
 * 폴링이 끝났는데도 기사가 없을 때의 빈 상태 카드.
 */
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { NEWS_LIST_PERIOD_KEY } from '@/shared/lib/news/periodLabels';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { NewsListHeading } from './NewsListHeading';

/** 조회 기간을 문구에 넣어 "그 기간에 기사가 없음"을 알린다. */
export function NewsListEmpty() {
    const t = useTranslations('widgets.news');
    const tPeriod = useTranslations('shared.lib.newsPeriod');
    return (
        <section
            aria-labelledby="news-list-heading"
            className={cn(
                SURFACE_CARD,
                'w-full max-w-full min-w-0 overflow-hidden p-6'
            )}
        >
            <div className="mb-3">
                <NewsListHeading />
            </div>
            <p className="text-sm text-secondary-400">
                {t('NewsList.b75118', {
                    v0: tPeriod(NEWS_LIST_PERIOD_KEY),
                })}
            </p>
        </section>
    );
}
