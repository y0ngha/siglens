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
 * 히어로 통계 6개. AI 전략 자체의 결과만 싣는다 — 단순 보유와의 비교는 싣지 않는다. 최대 낙폭은
 * 청산된 매매만으로 그린 곡선이라 그 기준을 라벨에 적는다.
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
            />
            <StatCard
                value={`${stats.portfolioMaxDrawdownPct.toFixed(1)}%`}
                label={t('maxDrawdownLabel')}
                valueClassName="text-ui-warning-text"
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
