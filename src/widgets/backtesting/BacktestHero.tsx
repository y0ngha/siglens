import { useTranslations } from 'next-intl';
import type { BacktestStats } from '@/entities/backtest-case/model';
import { StatGrid } from './ui/hero/StatGrid';
import { formatPeriodMonth } from './utils/formatPeriodMonth';

interface BacktestHeroProps {
    stats: BacktestStats;
}

/** 백테스트 페이지 머리말 — 기간 키커, 제목, 설명, 핵심 지표 그리드. */
export function BacktestHero({ stats }: BacktestHeroProps) {
    const t = useTranslations('widgets.backtesting');
    const period = `${formatPeriodMonth(stats.periodStart)} – ${formatPeriodMonth(stats.periodEnd)}`;

    return (
        <header className="border-b border-secondary-700 py-10 text-center">
            <div className="page-container">
                <p className="mb-2 font-mono text-xs tracking-[0.14em] text-secondary-400 uppercase">
                    BACKTESTING RESULTS | {period}
                </p>
                <h1 className="mb-3 text-2xl font-bold text-balance text-secondary-50 sm:text-3xl">
                    {t('BacktestHero.d8b543')}
                </h1>
                <p className="mx-auto mb-8 max-w-2xl text-sm leading-relaxed text-secondary-400 sm:text-base">
                    {t('BacktestHero.116858')}
                    <br />
                    {t('BacktestHero.caee31')}
                </p>
                <StatGrid stats={stats} />
            </div>
        </header>
    );
}
