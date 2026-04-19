import type { BacktestMeta } from '@/domain/types';

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
            <div className={`font-mono text-lg font-bold tabular-nums ${valueClassName}`}>
                {value}
            </div>
            <div className="mt-0.5 text-[10px] text-secondary-500">{label}</div>
        </div>
    );
}

export function BacktestHero({ meta }: BacktestHeroProps) {
    return (
        <header className="border-b border-secondary-800 px-6 py-6 text-center">
            <p className="mb-1.5 text-[10px] uppercase tracking-widest text-secondary-500">
                BACKTESTING RESULTS · {meta.period}
            </p>
            <h1 className="mb-5 text-balance text-xl font-bold text-secondary-100">
                Siglens가 얼마나 정확한가요?
            </h1>
            <div className="inline-flex items-center gap-5 rounded-lg border border-secondary-700 bg-secondary-800/40 px-6 py-3">
                <StatCard
                    value={`${meta.winRate}%`}
                    label="지표 신호 승률"
                    valueClassName="text-chart-bullish"
                />
                <div className="h-8 w-px bg-secondary-700" aria-hidden="true" />
                <StatCard
                    value={`${meta.aiWinRate}%`}
                    label="AI 예측 승률"
                    valueClassName="text-primary-400"
                />
                <div className="h-8 w-px bg-secondary-700" aria-hidden="true" />
                <StatCard
                    value={`${meta.totalCases}개`}
                    label="총 케이스"
                    valueClassName="text-ui-warning"
                />
                <div className="h-8 w-px bg-secondary-700" aria-hidden="true" />
                <StatCard
                    value={`${meta.tickerCount}종목`}
                    label="Mag7 + 선도주"
                    valueClassName="text-secondary-300"
                />
            </div>
        </header>
    );
}
