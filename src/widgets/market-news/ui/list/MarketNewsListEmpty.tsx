/**
 * "뉴스 없음"과 "새로고침 실패로 비어 보임"은 사용자에게 다른 의미라 한 화면에서 갈라 준다.
 */
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { MarketNewsListHeader } from './MarketNewsListHeader';
import { MarketNewsPollNotice } from './MarketNewsPollNotice';

interface MarketNewsListEmptyProps {
    /** 폴링이 실패로 끝나 비어 있는 것이면 "뉴스 없음" 대신 실패 안내를 보여 준다. */
    pollFailed: boolean;
    /** 빈 문구에 "최근 N일"을 넣기 위한 조회 기간. */
    lookbackDays: number;
}

/** 실패를 "뉴스 없음"으로 오해하게 두면 사용자가 새로고침할 이유를 잃는다. */
export function MarketNewsListEmpty({
    pollFailed,
    lookbackDays,
}: MarketNewsListEmptyProps) {
    const t = useTranslations('widgets.market-news');
    return (
        <section
            aria-labelledby="market-news-list-heading"
            className={cn(
                SURFACE_CARD,
                'w-full max-w-full min-w-0 overflow-hidden p-6'
            )}
        >
            <MarketNewsListHeader lookbackDays={lookbackDays} />
            {pollFailed ? (
                <MarketNewsPollNotice />
            ) : (
                <p className="text-sm text-secondary-400">
                    {t('MarketNewsList.242236', {
                        v0: lookbackDays,
                    })}
                </p>
            )}
        </section>
    );
}
