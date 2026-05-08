import type { FearGreedHistoryPoint } from '@y0ngha/siglens-core';
import { FearGreedGauge } from '@/components/fear-greed/FearGreedGauge';
import { classifyScore } from '@/lib/fearGreedLabels';
import { cn } from '@/lib/cn';

interface FearGreedComparisonGaugesProps {
    history: FearGreedHistoryPoint[];
}

interface PeriodDef {
    key: 'now' | '1w' | '1m' | '1y';
    daysBack: number;
    label: string;
}

const TRADING_DAYS_1W = 5;
const TRADING_DAYS_1M = 21;
const TRADING_DAYS_1Y = 252;

const PERIODS: ReadonlyArray<PeriodDef> = [
    { key: 'now', daysBack: 0, label: '현재' },
    { key: '1w', daysBack: TRADING_DAYS_1W, label: '1주' },
    { key: '1m', daysBack: TRADING_DAYS_1M, label: '1개월' },
    { key: '1y', daysBack: TRADING_DAYS_1Y, label: '1년' },
];

/** Renders the 4 historical reference points as CNN-style mini gauges so the user
 *  can compare current sentiment to past windows visually (not just numerically). */
// No client-only APIs — RSC-safe, importable from both RSC and Client context.
export function FearGreedComparisonGauges({
    history,
}: FearGreedComparisonGaugesProps) {
    const valid = history.filter(
        (p): p is FearGreedHistoryPoint & { score: number } => p.score !== null
    );
    if (valid.length === 0) return null;
    const lastIdx = valid.length - 1;
    return (
        <ul className="flex flex-wrap items-end justify-around gap-2">
            {PERIODS.map(p => {
                // 0으로 클램프 — daysBack이 valid 길이를 초과하면 가장 오래된 entry로 폴백.
                const idx = Math.max(0, lastIdx - p.daysBack);
                const point = valid[idx];
                const score = Math.round(point.score);
                const label = point.label ?? classifyScore(score);
                return (
                    <li
                        key={p.key}
                        className={cn(
                            'min-w-[100px] flex-1 rounded-lg border p-1',
                            p.key === 'now'
                                ? 'border-primary-500/40'
                                : 'border-secondary-700/40'
                        )}
                    >
                        <FearGreedGauge
                            score={score}
                            label={label}
                            size="mini"
                            periodLabel={p.label}
                        />
                    </li>
                );
            })}
        </ul>
    );
}
