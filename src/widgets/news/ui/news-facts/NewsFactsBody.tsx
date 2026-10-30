/**
 * 사실 요약의 본문 문단들 — 기사 수, 최신 게시 시각, 분석 수, 감성 분포, 헤드라인, 면책 문구.
 */
import { useTranslations } from 'next-intl';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import type { NewsDisplayItem } from '@/shared/lib/types';
import { formatNewsPublishedAt } from '@/shared/lib/timeFormat';
import type { AssetClass } from '@/shared/config/marketProfile/types';
import {
    countAnalyzed,
    getHeadlineItems,
    getLatestPublishedAt,
    getSentimentCounts,
} from '../../utils/newsFacts';
import { HeadlineList } from './HeadlineList';

interface NewsFactsBodyProps {
    displayName: string;
    assetClass: AssetClass;
    items: readonly NewsDisplayItem[];
}

/** `items`가 비어 있지 않을 때만 쓴다(빈 경우는 상위가 안내 문구를 낸다). */
export function NewsFactsBody({
    displayName,
    assetClass,
    items,
}: NewsFactsBodyProps) {
    const t = useTranslations('widgets.news');
    const locale = useResolvedLocale();
    const latestPublishedAt = getLatestPublishedAt(items);
    const analyzedCount = countAnalyzed(items);
    const sentimentCounts = getSentimentCounts(items);

    return (
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-secondary-300">
            <p>
                {/* 티커를 따로 넘기지 않는다 — `displayName`이 이미
                    `Apple Inc. (AAPL)`처럼 티커를 품어서
                    `(AAPL) (AAPL)`로 두 번 나갔다. */}
                {t('NewsFactsSummary.34b3fc', {
                    v0: displayName,
                    v1: items.length,
                })}
            </p>
            {latestPublishedAt ? (
                <p>
                    {t('NewsFactsSummary.d54f8a', {
                        v0: formatNewsPublishedAt(latestPublishedAt, locale),
                    })}
                </p>
            ) : null}
            <p>{t('NewsFactsSummary.630450', { v0: analyzedCount })}</p>
            {analyzedCount > 0 ? (
                <p>
                    {t('NewsFactsSummary.0a451a', {
                        v0: sentimentCounts.bullish,
                        v1: sentimentCounts.neutral,
                        v2: sentimentCounts.bearish,
                    })}
                </p>
            ) : null}
            <HeadlineList
                heading={t('NewsFactsSummary.fc9900')}
                headlines={getHeadlineItems(items, locale)}
            />
            <p>
                {assetClass === 'crypto'
                    ? t('NewsFactsSummary.5a1c5f')
                    : t('NewsFactsSummary.c154a3')}
            </p>
        </div>
    );
}
