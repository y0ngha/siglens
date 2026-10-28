/**
 * 보강이 끝난 마켓 뉴스 카드의 배지 행.
 */
import type { MarketNewsCardItem } from '@/entities/market-news/lib/toCardItem';
import { NewsCategoryBadge } from '@/shared/ui/NewsCategoryBadge';
import { ImpactBadge } from './ImpactBadge';
import { SentimentBadge } from './SentimentBadge';

interface CardBadgeRowProps {
    item: MarketNewsCardItem;
    publishedDate: string;
}

/** 감성·영향(값이 있을 때만) · 카테고리 · 게시 시각 · 출처. */
export function CardBadgeRow({ item, publishedDate }: CardBadgeRowProps) {
    return (
        <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2">
            {item.sentiment !== null && (
                <SentimentBadge value={item.sentiment} />
            )}
            {item.priceImpact !== null && (
                <ImpactBadge value={item.priceImpact} />
            )}
            <NewsCategoryBadge
                value={item.category}
                className="text-secondary-300"
            />
            <time
                dateTime={item.publishedAt}
                className="text-xs text-secondary-400"
            >
                {publishedDate}
            </time>
            <span translate="no" className="text-xs text-secondary-400">
                {item.source}
            </span>
        </div>
    );
}
