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
            <div
                className={`font-mono text-lg font-bold tabular-nums ${valueClassName}`}
            >
                {value}
            </div>
            <div className="text-secondary-500 mt-0.5 text-[10px]">{label}</div>
        </div>
    );
}

export function BacktestHero({ meta }: BacktestHeroProps) {
    return (
        <header className="border-secondary-800 border-b px-6 py-6 text-center">
            <p className="text-secondary-500 mb-1.5 text-[10px] tracking-widest uppercase">
                BACKTESTING RESULTS · {meta.period}
            </p>
            <h1 className="text-secondary-100 mb-5 text-xl font-bold text-balance">
                Siglens가 얼마나 정확한가요?
            </h1>
            <div className="border-secondary-700 bg-secondary-800/40 inline-flex items-center gap-5 rounded-lg border px-6 py-3">
                <StatCard
                    value={`${meta.winRate}%`}
                    label="지표 신호 승률"
                    valueClassName="text-chart-bullish"
                />
                <div className="bg-secondary-700 h-8 w-px" aria-hidden="true" />
                <StatCard
                    value={`${meta.aiWinRate}%`}
                    label="AI 예측 승률"
                    valueClassName="text-primary-400"
                />
                <div className="bg-secondary-700 h-8 w-px" aria-hidden="true" />
                <StatCard
                    value={`${meta.totalCases}개`}
                    label="총 케이스"
                    valueClassName="text-ui-warning"
                />
                <div className="bg-secondary-700 h-8 w-px" aria-hidden="true" />
                <StatCard
                    value={`${meta.tickerCount}종목`}
                    label="Mag7 + 선도주"
                    valueClassName="text-secondary-300"
                />
            </div>
        </header>
    );
}
