'use client';

/**
 * 뉴스 카드 한 장 — 공유 `NewsCardShell`에 배지 줄·본문 섹션·스켈레톤을 채워 넣는다.
 */
import { useTranslations } from 'next-intl';
import { useCurrentLocale } from '@/shared/i18n/LocaleContext';
import type { NewsDisplayItem } from '@/shared/lib/types';
import { NewsCardShell } from '@/shared/ui/NewsCardShell';
import { NewsCategoryBadge } from '@/shared/ui/NewsCategoryBadge';
import { buildNewsCardView } from '../../utils/newsCardView';
import { AnalysisSkeleton } from './AnalysisSkeleton';
import { ImpactBadge } from './ImpactBadge';
import { NewsBodySkeleton } from './NewsBodySkeleton';
import { NewsTextSection } from './NewsTextSection';
import { SentimentBadge } from './SentimentBadge';

interface NewsCardProps {
    item: NewsDisplayItem;
}

/** 보강 전 카드는 배지·본문 자리에 스켈레톤을 보인다. */
export function NewsCard({ item }: NewsCardProps) {
    const t = useTranslations('widgets.news');
    const locale = useCurrentLocale();
    const view = buildNewsCardView(item, locale);

    return (
        <NewsCardShell
            title={view.title}
            fallbackTitle={item.source}
            isHighImpact={view.isHighImpact}
            pending={view.pending}
            url={item.url}
            analysisSkeleton={<AnalysisSkeleton />}
            summarySkeletonLine={<NewsBodySkeleton />}
            badgeRow={
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {item.sentiment !== null && (
                        <SentimentBadge value={item.sentiment} />
                    )}
                    {item.priceImpact !== null && (
                        <ImpactBadge value={item.priceImpact} />
                    )}
                    <NewsCategoryBadge
                        value={item.category}
                        className="text-secondary-400"
                    />
                    <time
                        dateTime={item.publishedAt}
                        className="text-xs text-secondary-400"
                    >
                        {view.publishedDate}
                    </time>
                    <span className="text-xs text-secondary-400">
                        {item.source}
                    </span>
                </div>
            }
            bodySection={
                <>
                    {view.body !== null && (
                        <NewsTextSection
                            label={t('NewsList.c67b87')}
                            text={view.body}
                        />
                    )}
                    {view.summary !== null && (
                        <NewsTextSection
                            label={t('NewsList.3ea27a')}
                            text={view.summary}
                        />
                    )}
                </>
            }
            linkChildren={t('NewsList.850458')}
        />
    );
}
