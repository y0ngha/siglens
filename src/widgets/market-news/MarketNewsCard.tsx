/**
 * 마켓 뉴스 카드 한 장 — 표시 값을 계산하고 `ui/card/`의 조각을 `NewsCardShell`에 꽂는다.
 */
import { useTranslations } from 'next-intl';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import type { NewsFeedCategoryId } from '@/entities/market-news/lib/categoryConfig';
import type { MarketNewsCardItem } from '@/entities/market-news/lib/toCardItem';
import { formatNewsPublishedAt } from '@/shared/lib/timeFormat';
import { NewsCardShell } from '@/shared/ui/NewsCardShell';
import {
    resolveNewsSummary,
    resolveNewsTitle,
} from '@/shared/lib/news/resolveNewsTitle';
import { isMarketNewsCardPending } from './utils/marketNewsCardPending';
import { buildTickerChips } from './utils/tickerChips';
import { AnalysisSkeleton } from './ui/card/AnalysisSkeleton';
import { CardBadgeRow } from './ui/card/CardBadgeRow';
import { CardSummarySection } from './ui/card/CardSummarySection';
import { SummarySkeletonLine } from './ui/card/SummarySkeletonLine';
import { TickerChips } from './ui/card/TickerChips';

export interface MarketNewsCardProps {
    category: NewsFeedCategoryId;
    item: MarketNewsCardItem;
    /**
     * 보강 폴링이 끝났음에도 아직 보강되지 않은 카드를 스켈레톤 대신 보강 전 모습으로 그린다.
     * 폴링이 실패·상한·정체로 멈추면 영영 오지 않을 결과를 기다리는 스피너가 남기 때문이다.
     */
    enrichmentStopped?: boolean;
}

/**
 * 마켓 뉴스 카드. 티커 칩(주식 큐레이션 종목만 딥링크)과 원문 링크를 갖고, 보강 전 카드는
 * 백그라운드 LLM이 끝날 때까지 스켈레톤을 보인다. `priceImpact === 'high'`이면 종목 뉴스
 * 카드처럼 왼쪽에 amber 강조선이 붙는다.
 */
export function MarketNewsCard({
    category,
    item,
    enrichmentStopped = false,
}: MarketNewsCardProps) {
    const t = useTranslations('widgets.market-news');
    const locale = useResolvedLocale();
    const unenriched = isMarketNewsCardPending(item);
    const pending = unenriched && !enrichmentStopped;
    const summary = resolveNewsSummary(item);
    const chips = buildTickerChips(category, item.tickers);

    return (
        <NewsCardShell
            title={resolveNewsTitle(item, locale)}
            fallbackTitle={item.source}
            isHighImpact={!unenriched && item.priceImpact === 'high'}
            pending={pending}
            url={item.url}
            analysisSkeleton={<AnalysisSkeleton />}
            summarySkeletonLine={<SummarySkeletonLine />}
            badgeRow={
                <CardBadgeRow
                    item={item}
                    publishedDate={formatNewsPublishedAt(
                        item.publishedAt,
                        locale
                    )}
                />
            }
            tickerChipSlot={
                chips.length > 0 ? <TickerChips chips={chips} /> : undefined
            }
            bodySection={
                summary !== null && <CardSummarySection summary={summary} />
            }
            linkChildren={
                <>
                    {t('MarketNewsCard.adb2bb')}{' '}
                    <span aria-hidden="true">→</span>
                </>
            }
        />
    );
}
