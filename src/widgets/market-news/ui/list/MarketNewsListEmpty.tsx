/**
 * 보여 줄 뉴스가 없을 때의 목록 화면.
 */
import { useTranslations } from 'next-intl';
import { MARKET_NEWS_LOOKBACK_DAYS } from '@/entities/market-news/lib/marketNewsConstants';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { MarketNewsListHeader } from './MarketNewsListHeader';
import { MarketNewsPollNotice } from './MarketNewsPollNotice';

interface MarketNewsListEmptyProps {
    /** 폴링이 실패로 끝나 비어 있는 것이면 "뉴스 없음" 대신 실패 안내를 보여 준다. */
    pollFailed: boolean;
}

/** 조회 기간 동안 뉴스가 없다는 안내. 새로고침 실패로 빈 경우엔 실패 안내로 바뀐다. */
export function MarketNewsListEmpty({ pollFailed }: MarketNewsListEmptyProps) {
    const t = useTranslations('widgets.market-news');
    return (
        <section
            aria-labelledby="market-news-list-heading"
            className={cn(
                SURFACE_CARD,
                'w-full max-w-full min-w-0 overflow-hidden p-6'
            )}
        >
            <MarketNewsListHeader />
            {pollFailed ? (
                <MarketNewsPollNotice />
            ) : (
                <p className="text-sm text-secondary-400">
                    {t('MarketNewsList.242236', {
                        v0: MARKET_NEWS_LOOKBACK_DAYS,
                    })}
                </p>
            )}
        </section>
    );
}
