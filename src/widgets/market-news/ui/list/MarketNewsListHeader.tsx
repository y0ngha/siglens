/**
 * 마켓 뉴스 목록의 제목 줄.
 */
import { useTranslations } from 'next-intl';
import { MARKET_NEWS_LOOKBACK_DAYS } from '@/entities/market-news/lib/marketNewsConstants';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';

/** 제목(`market-news-list-heading`)과 조회 기간 배지. 목록 섹션들이 `aria-labelledby`로 가리킨다. */
export function MarketNewsListHeader() {
    const t = useTranslations('widgets.market-news');
    const tMisc = useTranslations('shared.ui.misc');
    return (
        <div className="flex items-center justify-between gap-2">
            <h2 id="market-news-list-heading" className={HEADING_SECTION}>
                {t('MarketNewsList.d107e1')}
            </h2>
            <span className="rounded bg-secondary-700 px-2 py-0.5 text-xs text-secondary-300">
                {tMisc('lastNDays', { v0: MARKET_NEWS_LOOKBACK_DAYS })}
            </span>
        </div>
    );
}
