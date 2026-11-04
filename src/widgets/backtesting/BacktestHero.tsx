import { useTranslations } from 'next-intl';
import type { BacktestStats } from '@/entities/backtest-case/model';
import { StatGrid } from './ui/hero/StatGrid';
import { formatPeriodMonth } from './utils/formatPeriodMonth';
import { periodYears } from './utils/periodYears';

interface BacktestHeroProps {
    stats: BacktestStats;
}

export function BacktestHero({ stats }: BacktestHeroProps) {
    const t = useTranslations('widgets.backtesting.hero');
    const period = `${formatPeriodMonth(stats.periodStart)} – ${formatPeriodMonth(stats.periodEnd)}`;

    return (
        <header className="border-b border-secondary-700 py-10 text-center">
            <div className="page-container">
                <p className="mb-2 font-mono text-xs tracking-[0.14em] text-secondary-400 uppercase">
                    BACKTESTING RESULTS | {period}
                </p>
                <h1 className="mb-3 text-2xl font-bold text-balance text-secondary-50 sm:text-3xl">
                    {t('title', {
                        v0: periodYears(stats.periodStart, stats.periodEnd),
                    })}
                </h1>
                <p className="mx-auto mb-8 max-w-2xl text-sm leading-relaxed text-pretty text-secondary-400 sm:text-base">
                    {t('lead', { v0: stats.perTicker.length })}
                    <br />
                    {t('disclaimer')}
                </p>
                <StatGrid stats={stats} />
            </div>
        </header>
    );
}
