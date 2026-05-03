import type { CSSProperties } from 'react';
import type {
    FundamentalAnalystEstimateInput,
    FundamentalGradesConsensusInput,
    FundamentalPriceTargetConsensusInput,
    FundamentalPriceTargetSummaryInput,
} from '@y0ngha/siglens-core';

interface FutureDirectionCardProps {
    estimates: FundamentalAnalystEstimateInput | null;
    grades: FundamentalGradesConsensusInput | null;
    ptConsensus: FundamentalPriceTargetConsensusInput | null;
    ptSummary: FundamentalPriceTargetSummaryInput | null;
}

interface GradesBarProps {
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
}

function GradesBar({ strongBuy, buy, hold, sell, strongSell }: GradesBarProps) {
    const total = strongBuy + buy + hold + sell + strongSell;
    if (total === 0) return null;

    const pct = (n: number) => ((n / total) * 100).toFixed(1);

    return (
        <div className="mt-3">
            <div className="flex overflow-hidden rounded-md" aria-hidden="true">
                {strongBuy > 0 && (
                    <div
                        title={`강력 매수 ${strongBuy}`}
                        className="bg-ui-success h-3 w-[var(--bar-w)]"
                        style={
                            { '--bar-w': `${pct(strongBuy)}%` } as CSSProperties
                        }
                    />
                )}
                {buy > 0 && (
                    <div
                        title={`매수 ${buy}`}
                        className="bg-ui-success/60 h-3 w-[var(--bar-w)]"
                        style={{ '--bar-w': `${pct(buy)}%` } as CSSProperties}
                    />
                )}
                {hold > 0 && (
                    <div
                        title={`중립 ${hold}`}
                        className="bg-ui-warning h-3 w-[var(--bar-w)]"
                        style={{ '--bar-w': `${pct(hold)}%` } as CSSProperties}
                    />
                )}
                {sell > 0 && (
                    <div
                        title={`매도 ${sell}`}
                        className="bg-ui-danger/60 h-3 w-[var(--bar-w)]"
                        style={{ '--bar-w': `${pct(sell)}%` } as CSSProperties}
                    />
                )}
                {strongSell > 0 && (
                    <div
                        title={`강력 매도 ${strongSell}`}
                        className="bg-ui-danger h-3 w-[var(--bar-w)]"
                        style={
                            {
                                '--bar-w': `${pct(strongSell)}%`,
                            } as CSSProperties
                        }
                    />
                )}
            </div>
            <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <div className="flex items-center gap-1">
                    <span
                        className="bg-ui-success block h-2 w-2 rounded-sm"
                        aria-hidden="true"
                    />
                    <dt className="text-muted-foreground">강력 매수</dt>
                    <dd className="font-mono font-medium">{strongBuy}</dd>
                </div>
                <div className="flex items-center gap-1">
                    <span
                        className="bg-ui-success/60 block h-2 w-2 rounded-sm"
                        aria-hidden="true"
                    />
                    <dt className="text-muted-foreground">매수</dt>
                    <dd className="font-mono font-medium">{buy}</dd>
                </div>
                <div className="flex items-center gap-1">
                    <span
                        className="bg-ui-warning block h-2 w-2 rounded-sm"
                        aria-hidden="true"
                    />
                    <dt className="text-muted-foreground">중립</dt>
                    <dd className="font-mono font-medium">{hold}</dd>
                </div>
                <div className="flex items-center gap-1">
                    <span
                        className="bg-ui-danger/60 block h-2 w-2 rounded-sm"
                        aria-hidden="true"
                    />
                    <dt className="text-muted-foreground">매도</dt>
                    <dd className="font-mono font-medium">{sell}</dd>
                </div>
                <div className="flex items-center gap-1">
                    <span
                        className="bg-ui-danger block h-2 w-2 rounded-sm"
                        aria-hidden="true"
                    />
                    <dt className="text-muted-foreground">강력 매도</dt>
                    <dd className="font-mono font-medium">{strongSell}</dd>
                </div>
            </dl>
        </div>
    );
}

/**
 * RSC section: analyst consensus — EPS/revenue estimates, buy/sell
 * breakdown bar, and price target range.
 *
 * Data is fetched by the parent RSC page and passed as typed props.
 */
export function FutureDirectionCard({
    estimates,
    grades,
    ptConsensus,
    ptSummary,
}: FutureDirectionCardProps) {
    if (estimates === null && grades === null && ptConsensus === null)
        return null;

    const fmtUsd = (v: number | null) =>
        v !== null
            ? new Intl.NumberFormat('ko-KR', {
                  style: 'currency',
                  currency: 'USD',
                  maximumFractionDigits: 2,
              }).format(v)
            : '—';

    const fmtBig = (v: number | null) =>
        v !== null
            ? new Intl.NumberFormat('ko-KR', {
                  notation: 'compact',
                  style: 'currency',
                  currency: 'USD',
                  maximumFractionDigits: 1,
              }).format(v)
            : '—';

    return (
        <section
            aria-labelledby="future-heading"
            className="border-border bg-card rounded-xl border p-6"
        >
            <h2
                id="future-heading"
                className="mb-4 text-lg font-semibold tracking-tight"
            >
                미래 방향
            </h2>

            {estimates !== null && (
                <div className="mb-5">
                    <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-widest uppercase">
                        애널리스트 추정
                    </h3>
                    <dl className="grid grid-cols-2 gap-3">
                        <div className="bg-muted/40 rounded-lg px-4 py-3">
                            <dt className="text-muted-foreground text-xs">
                                EPS 컨센서스
                            </dt>
                            <dd className="mt-1 font-mono text-lg font-semibold tabular-nums">
                                {fmtUsd(estimates.estimatedEpsAvg)}
                            </dd>
                        </div>
                        <div className="bg-muted/40 rounded-lg px-4 py-3">
                            <dt className="text-muted-foreground text-xs">
                                매출 컨센서스
                            </dt>
                            <dd className="mt-1 font-mono text-lg font-semibold tabular-nums">
                                {fmtBig(estimates.estimatedRevenueAvg)}
                            </dd>
                        </div>
                    </dl>
                </div>
            )}

            {ptConsensus !== null && (
                <div className="mb-5">
                    <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-widest uppercase">
                        목표 주가
                    </h3>
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
                        {// TS infers (string | number | null)[][] from the entries array; the source
                        // data is structurally [string, number | null] per the priceTargetSummary shape.
                        (
                            [
                                ['하단', ptConsensus.targetLow],
                                ['중앙값', ptConsensus.targetMedian],
                                ['컨센서스', ptConsensus.targetConsensus],
                                ['상단', ptConsensus.targetHigh],
                            ] as [string, number | null][]
                        ).map(([label, val]) => (
                            <div key={label}>
                                <dt className="text-muted-foreground text-xs">
                                    {label}
                                </dt>
                                <dd className="font-mono text-sm font-medium tabular-nums">
                                    {fmtUsd(val)}
                                </dd>
                            </div>
                        ))}
                    </dl>
                    {ptSummary !== null && (
                        <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                            <div className="flex gap-1">
                                <dt className="text-muted-foreground">1개월</dt>
                                <dd className="font-mono">
                                    {fmtUsd(ptSummary.lastMonth.avgPriceTarget)}
                                </dd>
                            </div>
                            <div className="flex gap-1">
                                <dt className="text-muted-foreground">3개월</dt>
                                <dd className="font-mono">
                                    {fmtUsd(
                                        ptSummary.lastQuarter.avgPriceTarget
                                    )}
                                </dd>
                            </div>
                            <div className="flex gap-1">
                                <dt className="text-muted-foreground">
                                    12개월
                                </dt>
                                <dd className="font-mono">
                                    {fmtUsd(ptSummary.lastYear.avgPriceTarget)}
                                </dd>
                            </div>
                        </dl>
                    )}
                </div>
            )}

            {grades !== null && (
                <div>
                    <h3 className="text-muted-foreground mb-1 text-xs font-medium tracking-widest uppercase">
                        투자의견 컨센서스
                    </h3>
                    <GradesBar
                        strongBuy={grades.strongBuy}
                        buy={grades.buy}
                        hold={grades.hold}
                        sell={grades.sell}
                        strongSell={grades.strongSell}
                    />
                </div>
            )}
        </section>
    );
}
