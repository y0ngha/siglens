import { useTranslations } from 'next-intl';
import type { BacktestMeta } from '@y0ngha/siglens-core';

interface BacktestHeroProps {
    meta: BacktestMeta;
}

interface StatCardProps {
    value: string;
    label: string;
    valueClassName: string;
}

function StatCard({ value, label, valueClassName }: StatCardProps) {
    return (
        <div className="text-center">
            <div
                className={`font-mono text-lg font-bold tabular-nums ${valueClassName}`}
            >
                {value}
            </div>
            <div className="mt-0.5 text-[10px] text-secondary-500">{label}</div>
        </div>
    );
}

export function BacktestHero({ meta }: BacktestHeroProps) {
    const t = useTranslations('widgets.backtesting');
    return (
        <header className="border-b border-secondary-800 px-6 py-6 text-center">
            <p className="mb-1.5 text-[10px] tracking-widest text-secondary-500 uppercase">
                BACKTESTING RESULTS · {meta.period}
            </p>
            <h1 className="mb-2 text-xl font-bold text-balance text-secondary-100">
                {t('BacktestHero.d8b543')}
            </h1>
            <p className="mb-5 text-sm leading-relaxed text-secondary-400">
                {t('BacktestHero.116858')}
                <br />
                {t('BacktestHero.139227')}
            </p>
            <div className="inline-flex items-center gap-5 rounded-lg border border-secondary-700 bg-secondary-800/40 px-6 py-3">
                <StatCard
                    value={`${meta.winRate}%`}
                    label={t('BacktestHero.394fff')}
                    valueClassName="text-chart-bullish"
                />
                <div className="h-8 w-px bg-secondary-700" aria-hidden="true" />
                <StatCard
                    value={`${meta.aiWinRate}%`}
                    label={t('BacktestHero.5a254c')}
                    valueClassName="text-primary-400"
                />
                <div className="h-8 w-px bg-secondary-700" aria-hidden="true" />
                <StatCard
                    value={`${meta.totalCases}개`}
                    label={t('BacktestHero.f92294')}
                    valueClassName="text-ui-warning"
                />
                <div className="h-8 w-px bg-secondary-700" aria-hidden="true" />
                <StatCard
                    value={`${meta.tickerCount}종목`}
                    label={t('BacktestHero.530709')}
                    valueClassName="text-secondary-300"
                />
            </div>
        </header>
    );
}
