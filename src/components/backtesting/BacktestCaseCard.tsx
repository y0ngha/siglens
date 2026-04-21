import type { BacktestCase, BacktestRiskLevel } from '@/domain/types';
import { cn } from '@/lib/cn';
import { formatUsdCurrency } from '@/lib/priceFormat';

interface BacktestCaseCardProps {
    case_: BacktestCase;
}

interface EntryRecBadgeProps {
    recommendation: 'enter' | 'wait' | 'avoid';
}

function EntryRecBadge({ recommendation }: EntryRecBadgeProps) {
    const config = {
        enter: {
            label: 'AI 진입 권고',
            cls: 'bg-chart-bullish/10 text-chart-bullish border-chart-bullish/30',
        },
        avoid: {
            label: 'AI 회피 권고',
            cls: 'bg-chart-bearish/10 text-chart-bearish border-chart-bearish/30',
        },
        wait: {
            label: 'AI 관망',
            cls: 'bg-secondary-800 text-secondary-400 border-secondary-700',
        },
    }[recommendation];
    return (
        <span
            translate="no"
            className={cn(
                'rounded border px-1.5 py-0.5 text-[9px] font-semibold',
                config.cls
            )}
        >
            {config.label}
        </span>
    );
}

interface RiskBadgeProps {
    level: BacktestRiskLevel;
}

function RiskBadge({ level }: RiskBadgeProps) {
    const isHigh = level === 'high' || level === 'extreme';
    const isLow = level === 'low';
    const cls = isHigh
        ? 'bg-ui-warning/10 text-ui-warning border-ui-warning/30'
        : isLow
          ? 'bg-chart-bullish/10 text-chart-bullish border-chart-bullish/30'
          : 'bg-secondary-800 text-secondary-400 border-secondary-700';
    return (
        <span
            className={cn(
                'rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase',
                cls
            )}
        >
            {level}
        </span>
    );
}

const winClasses = {
    article: 'border-secondary-700',
    badge: 'bg-secondary-700 text-primary-400',
    returnText: 'text-chart-bullish',
    aiSummary: 'border-chart-bullish',
    tag: 'border border-primary-900/50 bg-primary-950/40 text-primary-400',
} as const;

const lossClasses = {
    article: 'border-chart-bearish/20',
    badge: 'bg-chart-bearish/10 text-chart-bearish',
    returnText: 'text-chart-bearish',
    aiSummary: 'border-ui-warning',
    tag: 'border border-ui-warning/30 bg-ui-warning/10 text-ui-warning',
} as const;

export function BacktestCaseCard({ case_: c }: BacktestCaseCardProps) {
    const isWin = c.result === 'win';
    const v = isWin ? winClasses : lossClasses;
    const returnLabel = `${c.returnPct >= 0 ? '+' : ''}${c.returnPct.toFixed(1)}%`;

    const firstBullishTarget = c.aiAnalysis.bullishTargets[0];
    const showPredictionBlock =
        c.aiAnalysis.bullishTargets.length > 0 ||
        c.aiAnalysis.stopLoss !== undefined ||
        c.aiAnalysis.takeProfit !== undefined;

    return (
        <article
            aria-label={`${c.ticker} ${c.entryDate} ${isWin ? '수익' : '손실'} ${returnLabel}`}
            className={cn(
                'bg-secondary-800/50 rounded-lg border p-3',
                v.article
            )}
        >
            <div className="mb-2 flex items-center gap-2">
                <span
                    translate="no"
                    className={cn(
                        'rounded px-2 py-0.5 text-xs font-bold',
                        v.badge
                    )}
                >
                    {c.ticker}
                </span>

                <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-xs">
                    <div
                        className={cn(
                            'shrink-0 rounded border px-2 py-1',
                            c.signalType === 'buy'
                                ? 'border-chart-bullish/20 bg-chart-bullish/10'
                                : 'border-chart-bearish/20 bg-chart-bearish/10'
                        )}
                    >
                        <span
                            className={cn(
                                'font-semibold',
                                c.signalType === 'buy'
                                    ? 'text-chart-bullish'
                                    : 'text-chart-bearish'
                            )}
                        >
                            {c.signalType === 'buy' ? '매수' : '매도'}
                        </span>
                        <span className="text-secondary-400 ml-1">
                            {c.entryDate}
                        </span>
                        <span className="text-secondary-500 ml-1 font-mono tabular-nums">
                            {formatUsdCurrency(c.entryPrice)}
                        </span>
                    </div>
                    <span
                        className="text-secondary-600 shrink-0"
                        aria-hidden="true"
                    >
                        →
                    </span>
                    <span className="text-secondary-500 shrink-0 text-[10px] whitespace-nowrap">
                        <span className="tabular-nums">{c.holdingDays}</span>일
                    </span>
                    <span
                        className="text-secondary-600 shrink-0"
                        aria-hidden="true"
                    >
                        →
                    </span>
                    <div className="border-chart-bearish/20 bg-chart-bearish/10 shrink-0 rounded border px-2 py-1 text-right">
                        <span className="text-chart-bearish font-semibold">
                            {c.exitReason === 'stop_loss' ? '손절' : '매도'}
                        </span>
                        <span className="text-secondary-400 ml-1">
                            {c.exitDate}
                        </span>
                        <span className="text-secondary-500 ml-1 font-mono tabular-nums">
                            {formatUsdCurrency(c.exitPrice)}
                        </span>
                    </div>
                </div>

                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                    <span
                        className={cn(
                            'font-mono text-sm font-bold tabular-nums',
                            v.returnText
                        )}
                    >
                        {returnLabel}
                    </span>
                    <span
                        aria-hidden="true"
                        className={cn('text-xs', v.returnText)}
                    >
                        {isWin ? '✓' : '✗'}
                    </span>
                    <span className="sr-only">{isWin ? '수익' : '손실'}</span>
                </div>
            </div>

            <p
                className={cn(
                    'text-secondary-400 line-clamp-3 rounded-r border-l-2 bg-black/20 px-3 py-2 text-[11px] leading-relaxed',
                    v.aiSummary
                )}
            >
                {c.aiAnalysis.summary}
            </p>

            {c.aiAnalysis.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.aiAnalysis.tags.map(tag => (
                        <span
                            key={tag}
                            className={cn(
                                'rounded px-1.5 py-0.5 text-[10px]',
                                v.tag
                            )}
                        >
                            {tag}
                        </span>
                    ))}
                </div>
            )}

            {showPredictionBlock && (
                <div className="bg-secondary-900/60 text-secondary-400 mt-2 rounded px-3 py-2 text-[10px]">
                    <div className="mb-1 flex items-center gap-2">
                        <span className="text-secondary-500 text-[9px] font-semibold tracking-wider uppercase">
                            AI 예측 레벨
                        </span>
                        <EntryRecBadge
                            recommendation={c.aiAnalysis.entryRecommendation}
                        />
                        {c.aiAnalysis.riskLevel && (
                            <RiskBadge level={c.aiAnalysis.riskLevel} />
                        )}
                    </div>

                    <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono tabular-nums">
                        {firstBullishTarget && (
                            <div>
                                <span className="text-secondary-500">
                                    목표가:{' '}
                                </span>
                                <span className="text-chart-bullish">
                                    {formatUsdCurrency(
                                        firstBullishTarget.price
                                    )}
                                </span>
                                {c.aiTrendHit && (
                                    <span className="text-chart-bullish ml-1">
                                        ✓ 도달
                                    </span>
                                )}
                            </div>
                        )}
                        {c.aiAnalysis.takeProfit !== undefined && (
                            <div>
                                <span className="text-secondary-500">TP: </span>
                                <span className="text-chart-bullish">
                                    {formatUsdCurrency(c.aiAnalysis.takeProfit)}
                                </span>
                                {c.exitReason === 'take_profit' && (
                                    <span className="text-chart-bullish ml-1">
                                        ✓
                                    </span>
                                )}
                            </div>
                        )}
                        {c.aiAnalysis.stopLoss !== undefined && (
                            <div>
                                <span className="text-secondary-500">SL: </span>
                                <span className="text-chart-bearish">
                                    {formatUsdCurrency(c.aiAnalysis.stopLoss)}
                                </span>
                                {c.exitReason === 'stop_loss' && (
                                    <span className="text-chart-bearish ml-1">
                                        ✓
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {firstBullishTarget?.basis && (
                        <p className="text-secondary-500 mt-1 line-clamp-1 text-[9px]">
                            근거: {firstBullishTarget.basis}
                        </p>
                    )}
                </div>
            )}
        </article>
    );
}
