import type {
    FundamentalSectorPerformanceInput,
    FundamentalSectorHistoricalInput,
} from '@y0ngha/siglens-core';
import { cn } from '@/lib/cn';

interface SectorDirectionCardProps {
    /** Sector name for display (resolved from company profile). */
    sector: string;
    /** Today's sector performance snapshot. */
    snapshot: FundamentalSectorPerformanceInput[];
    /** Historical daily sector performance (newest-first from FMP). */
    historical: FundamentalSectorHistoricalInput[];
}

/** 스파크라인에 사용할 최근 일수. JSX 레이블에서도 같은 상수를 참조한다. */
const SPARKLINE_DAYS = 30;

interface SectorSparklineProps {
    data: FundamentalSectorHistoricalInput[];
}

/** Inline SVG mini sparkline for sector historical performance. Normalises last N data points to a fixed height band. */
function SectorSparkline({ data }: SectorSparklineProps) {
    // API returns newest-first; reverse to chronological order for display
    const recent = data.slice(0, SPARKLINE_DAYS).toReversed();
    if (recent.length < 2) return null;

    const values = recent.map(d => d.changesPercentage);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const W = 200;
    const H = 48;
    const xStep = W / (recent.length - 1);

    const points = recent
        .map((d, i) => {
            const x = i * xStep;
            const y = H - ((d.changesPercentage - min) / range) * H;
            return `${x},${y}`;
        })
        .join(' ');

    return (
        <svg
            viewBox={`0 0 ${W} ${H}`}
            aria-hidden="true"
            role="presentation"
            className="h-12 w-full overflow-visible"
            preserveAspectRatio="none"
        >
            <polyline
                points={points}
                fill="none"
                className="stroke-primary-500"
                strokeWidth="1.5"
                strokeLinejoin="round"
                strokeLinecap="round"
            />
        </svg>
    );
}

export function SectorDirectionCard({
    sector,
    snapshot,
    historical,
}: SectorDirectionCardProps) {
    const sectorEntry = snapshot.find(s => s.sector === sector);
    const todayPct = sectorEntry?.changesPercentage ?? null;
    const isPositive = todayPct !== null && todayPct >= 0;

    return (
        <section
            aria-labelledby="sector-heading"
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
        >
            <h2
                id="sector-heading"
                className="mb-1 text-lg font-semibold tracking-tight"
            >
                섹터 방향
            </h2>
            {sector !== '' && (
                <p className="text-secondary-400 mb-4 text-sm" translate="no">
                    {sector}
                </p>
            )}

            {todayPct !== null && (
                <div className="mb-4 flex items-center gap-3">
                    <span className="text-secondary-400 text-sm">오늘</span>
                    <span
                        className={cn(
                            'font-mono text-2xl font-bold tabular-nums',
                            isPositive
                                ? 'text-chart-bullish'
                                : 'text-chart-bearish'
                        )}
                    >
                        {isPositive ? '+' : ''}
                        {todayPct.toFixed(2)}%
                    </span>
                </div>
            )}

            {historical.length >= 2 && (
                <div>
                    <p className="text-secondary-400 mb-2 text-xs">
                        최근 {SPARKLINE_DAYS}거래일 섹터 수익률
                    </p>
                    <SectorSparkline data={historical} />
                </div>
            )}
        </section>
    );
}
