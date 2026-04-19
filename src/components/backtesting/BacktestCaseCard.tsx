import type { BacktestCase } from '@/domain/types';

interface BacktestCaseCardProps {
    case_: BacktestCase;
}

const priceFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

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

    return (
        <article
            aria-label={`${c.ticker} ${c.entryDate} ${isWin ? '수익' : '손실'} ${returnLabel}`}
            className={`rounded-lg border p-3 bg-secondary-800/50 ${v.article}`}
        >
            <div className="mb-2 flex items-center gap-2">
                <span
                    translate="no"
                    className={`rounded px-2 py-0.5 text-xs font-bold ${v.badge}`}
                >
                    {c.ticker}
                </span>

                <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-xs">
                    <div className="shrink-0 rounded border border-chart-bullish/20 bg-chart-bullish/10 px-2 py-1">
                        <span className="font-semibold text-chart-bullish">
                            {c.signalType === 'buy' ? '매수' : '매도'}
                        </span>
                        <span className="ml-1 text-secondary-400">{c.entryDate}</span>
                        <span className="ml-1 font-mono tabular-nums text-secondary-500">
                            {priceFormatter.format(c.entryPrice)}
                        </span>
                    </div>
                    <span className="shrink-0 text-secondary-600" aria-hidden="true">→</span>
                    <span className="shrink-0 whitespace-nowrap text-[10px] text-secondary-500">
                        <span className="tabular-nums">{c.holdingDays}</span>일
                    </span>
                    <span className="shrink-0 text-secondary-600" aria-hidden="true">→</span>
                    <div className="shrink-0 rounded border border-chart-bearish/20 bg-chart-bearish/10 px-2 py-1 text-right">
                        <span className="font-semibold text-chart-bearish">
                            {c.exitReason === 'stop_loss' ? '손절' : '매도'}
                        </span>
                        <span className="ml-1 text-secondary-400">{c.exitDate}</span>
                        <span className="ml-1 font-mono tabular-nums text-secondary-500">
                            {priceFormatter.format(c.exitPrice)}
                        </span>
                    </div>
                </div>

                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                    <span className={`font-mono text-sm font-bold tabular-nums ${v.returnText}`}>
                        {returnLabel}
                    </span>
                    <span aria-hidden="true" className={`text-xs ${v.returnText}`}>
                        {isWin ? '✓' : '✗'}
                    </span>
                    <span className="sr-only">{isWin ? '수익' : '손실'}</span>
                </div>
            </div>

            <p
                className={`line-clamp-3 rounded-r border-l-2 bg-black/20 px-3 py-2 text-[11px] leading-relaxed text-secondary-400 ${v.aiSummary}`}
            >
                {c.aiAnalysis.summary}
            </p>

            {c.aiAnalysis.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.aiAnalysis.tags.map(tag => (
                        <span key={tag} className={`rounded px-1.5 py-0.5 text-[10px] ${v.tag}`}>
                            {tag}
                        </span>
                    ))}
                </div>
            )}
        </article>
    );
}
