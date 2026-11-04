import { useTranslations } from 'next-intl';
import type { BacktestStats } from '@/entities/backtest-case/model';
import { cn } from '@/shared/lib/cn';
import { formatSignedPercent, signColorClass } from '@/shared/lib/priceFormat';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { StatCard } from './StatCard';

interface StatGridProps {
    stats: BacktestStats;
}

const MEAN_RETURN_DIGITS = 2;

/**
 * 히어로 통계 6개. 포트폴리오 수익률에는 같은 종목 보유와 SPY 보유를 함께 붙인다 — 아래 비교 표와
 * 같은 기준(같은 종목 균등 보유)을 먼저 보여 주고 시장(SPY)을 덧붙인다. 최대 낙폭은 청산 기준
 * 곡선이라 일별 종가로 잰 SPY 낙폭과 기준이 다르다는 것을 라벨과 서브라벨에 적는다.
 */
export function StatGrid({ stats }: StatGridProps) {
    const t = useTranslations('widgets.backtesting.hero');

    return (
        <div
            className={cn(
                SURFACE_CARD,
                'grid grid-cols-2 gap-x-8 gap-y-6 px-8 py-6 text-left sm:grid-cols-3 lg:grid-cols-6'
            )}
        >
            <StatCard
                value={formatSignedPercent(stats.portfolioReturnPct)}
                label={t('portfolioLabel', { v0: stats.perTicker.length })}
                valueClassName={signColorClass(stats.portfolioReturnPct)}
                subLabel={t('vsBenchmarks', {
                    v0: stats.perTicker.length,
                    v1: formatSignedPercent(stats.buyHoldMeanPct),
                    v2: formatSignedPercent(stats.spy.buyHoldPct),
                })}
            />
            <StatCard
                value={`${stats.portfolioMaxDrawdownPct.toFixed(1)}%`}
                label={t('maxDrawdownLabel')}
                valueClassName="text-ui-warning-text"
                subLabel={t('drawdownVsSpy', {
                    v0: `${stats.spy.buyHoldMaxDrawdownPct.toFixed(1)}%`,
                })}
            />
            <StatCard
                value={`${stats.winRate.toFixed(1)}%`}
                label={t('winRateLabel')}
                valueClassName="text-primary-400"
                subLabel={t('winRateSub', {
                    v0: stats.winningTrades,
                    v1: stats.closedTrades,
                })}
            />
            <StatCard
                value={t('tradesValue', { v0: stats.totalTrades })}
                label={t('tradesLabel')}
                valueClassName="text-secondary-200"
            />
            <StatCard
                value={formatSignedPercent(
                    stats.meanReturnPct,
                    MEAN_RETURN_DIGITS
                )}
                label={t('meanReturnLabel')}
                valueClassName={signColorClass(stats.meanReturnPct)}
            />
            <StatCard
                value={t('tradingDays', {
                    v0: stats.meanHoldingDays.toFixed(1),
                })}
                label={t('meanHoldingLabel')}
                valueClassName="text-secondary-300"
            />
        </div>
    );
}
