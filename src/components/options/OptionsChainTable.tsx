'use client';

import { InfoTooltip } from '@/components/ui/InfoTooltip';
import type { OptionsChain, OptionsSnapshot } from '@y0ngha/siglens-core';
import { aggregateOpenInterest, calculateMaxPain } from '@y0ngha/siglens-core';
import { useState } from 'react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface OptionsChainTableProps {
    symbol: string;
    /** 'YYYY-MM-DD' or 'all'. Maps to the appropriate chain via the same rule as Metrics/Chart. */
    expirationDate: string | 'all';
    snapshot: OptionsSnapshot;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const numberFormatter = new Intl.NumberFormat('en-US');

function formatOi(value: number): string {
    return numberFormatter.format(value);
}

function formatIv(value: number | null): string {
    if (value === null) return '—';
    return `${(value * 100).toFixed(1)}%`;
}

function formatBidAsk(bid: number | null, ask: number | null): string {
    if (bid === null && ask === null) return '—';
    const bidStr = bid !== null ? `$${bid.toFixed(2)}` : '—';
    const askStr = ask !== null ? `$${ask.toFixed(2)}` : '—';
    return `${bidStr}/${askStr}`;
}

function formatStrike(strike: number): string {
    const isInteger = Number.isInteger(strike);
    return `$${isInteger ? strike.toString() : strike.toFixed(1)}`;
}

/**
 * Finds the strike index closest to the underlying price.
 * Returns the strike value (not index).
 */
function findNearestStrike(strikes: number[], underlyingPrice: number): number | null {
    if (strikes.length === 0) return null;
    let nearest = strikes[0];
    let minDist = Math.abs(strikes[0] - underlyingPrice);
    for (const strike of strikes) {
        const dist = Math.abs(strike - underlyingPrice);
        if (dist < minDist) {
            minDist = dist;
            nearest = strike;
        }
    }
    return nearest;
}

// ---------------------------------------------------------------------------
// Tooltip content nodes (spec-exact copy — do NOT paraphrase)
// ---------------------------------------------------------------------------

const StrikeTooltip = (
    <>
        <p>옵션 계약에 정해진 매수/매도 가격이에요.</p>
        <p>콜은 &apos;이 가격에 살 권리&apos;, 풋은 &apos;이 가격에 팔 권리&apos;를 가진다는 뜻이에요.</p>
    </>
);

const OpenInterestTooltip = (
    <>
        <p>특정 옵션에 현재 살아있는(아직 청산 안 된) 계약 수예요.</p>
        <p>한쪽 가격대에 OI가 두텁다는 건 그 가격에 많은 사람이 베팅했다는 뜻이에요.</p>
    </>
);

const ImpliedVolatilityTooltip = (
    <>
        <p>옵션 시장이 예측하는 미래 변동성이에요.</p>
        <p>높을수록 옵션값이 비싸지고, 불확실성이 크다는 뜻이에요.</p>
    </>
);

// ---------------------------------------------------------------------------
// OptionsChainTable
// ---------------------------------------------------------------------------

export function OptionsChainTable({ symbol, expirationDate, snapshot }: OptionsChainTableProps) {
    const [expanded, setExpanded] = useState(false);

    // ---- chain selection (same logic as OptionsMetricsRow / OpenInterestChart) ----
    const nearestChain = snapshot.chains[0] ?? null;
    const selectedChain: OptionsChain | null =
        expirationDate === 'all'
            ? nearestChain
            : (snapshot.chains.find(c => c.expirationDate === expirationDate) ?? nearestChain);

    const nearestExpiry = nearestChain?.expirationDate ?? '';

    // ---- empty state ----
    const isEmpty =
        !selectedChain ||
        (selectedChain.calls.length === 0 && selectedChain.puts.length === 0);

    const totalContracts = selectedChain
        ? selectedChain.calls.length + selectedChain.puts.length
        : 0;

    // ---- collapsed toggle button ----
    const headerLabel = expanded
        ? `▾ 전체 옵션 chain 테이블 (선택된 만기: ${selectedChain?.expirationDate ?? '—'})`
        : `▸ 전체 옵션 chain 테이블 보기 (${numberFormatter.format(totalContracts)} contracts)`;

    if (isEmpty) {
        return (
            <div className="border-secondary-700 bg-secondary-800 rounded-xl border p-4 flex items-center justify-between w-full">
                <span className="text-secondary-400 text-sm">
                    ▸ 전체 옵션 chain 테이블 보기 (0 contracts)
                </span>
            </div>
        );
    }

    // ---- build rows ----
    const aggregatedStrikes = aggregateOpenInterest(selectedChain!);
    const callByStrike = new Map(selectedChain!.calls.map(c => [c.strike, c]));
    const putByStrike = new Map(selectedChain!.puts.map(p => [p.strike, p]));
    const rows = aggregatedStrikes.map(({ strike }) => ({
        strike,
        call: callByStrike.get(strike),
        put: putByStrike.get(strike),
    }));

    // ---- ATM / Max Pain ----
    const allStrikes = aggregatedStrikes.map(s => s.strike);
    const nearestStrike = findNearestStrike(allStrikes, snapshot.underlyingPrice);
    const maxPainStrike = calculateMaxPain(selectedChain!);

    return (
        <div>
            {/* Toggle button */}
            <button
                type="button"
                aria-expanded={expanded}
                aria-controls="options-chain-table"
                disabled={isEmpty}
                onClick={() => setExpanded(prev => !prev)}
                className="border-secondary-700 bg-secondary-800 rounded-xl border p-4 flex items-center justify-between cursor-pointer hover:border-primary-500 transition-colors focus-visible:ring-primary-500 focus-visible:ring-2 focus-visible:outline-none w-full"
            >
                <span className="text-secondary-200 text-sm">{headerLabel}</span>
            </button>

            {/* Expanded table */}
            <div id="options-chain-table" hidden={!expanded}>
                {/* "all" expiration note */}
                {expirationDate === 'all' && nearestExpiry && (
                    <p className="text-secondary-500 text-[10px] mt-2 px-1">
                        종합 만기 — 가장 가까운 만기를 표시합니다 ({nearestExpiry}). 다른 만기를 보려면 위 chip에서 선택하세요.
                    </p>
                )}

                <div className="overflow-x-auto mt-2">
                    <table className="w-full text-sm border-collapse">
                        <caption className="sr-only">
                            {symbol} {expirationDate} 옵션 chain (Strike별 콜/풋 가격, OI, IV)
                        </caption>

                        <thead className="text-secondary-400 border-secondary-700 border-b text-xs tracking-widest uppercase">
                            <tr>
                                <th scope="col" className="px-3 py-2 text-left">
                                    Strike{' '}
                                    <InfoTooltip>{StrikeTooltip}</InfoTooltip>
                                </th>
                                <th scope="col" className="px-3 py-2 text-right">
                                    Call (Bid/Ask)
                                </th>
                                <th scope="col" className="px-3 py-2 text-right">
                                    Call OI{' '}
                                    <InfoTooltip>{OpenInterestTooltip}</InfoTooltip>
                                </th>
                                <th scope="col" className="px-3 py-2 text-right">
                                    Call IV{' '}
                                    <InfoTooltip>{ImpliedVolatilityTooltip}</InfoTooltip>
                                </th>
                                <th scope="col" className="px-3 py-2 text-right">
                                    Put (Bid/Ask)
                                </th>
                                <th scope="col" className="px-3 py-2 text-right">
                                    Put OI
                                </th>
                                <th scope="col" className="px-3 py-2 text-right">
                                    Put IV
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {rows.map(({ strike, call, put }) => {
                                const isAtm = strike === nearestStrike;
                                const isMaxPain = !isNaN(maxPainStrike) && strike === maxPainStrike;

                                return (
                                    <tr
                                        key={strike}
                                        className={isAtm ? 'bg-primary-500/10' : undefined}
                                    >
                                        {/* Strike cell */}
                                        <td className="px-3 py-1.5 text-left font-mono tabular-nums text-secondary-200 whitespace-nowrap">
                                            {formatStrike(strike)}
                                            {isMaxPain && (
                                                <>
                                                    {' '}
                                                    <span aria-hidden="true">📍</span>
                                                    <span className="sr-only">Max Pain</span>
                                                </>
                                            )}
                                        </td>

                                        {/* Call Bid/Ask */}
                                        <td className="px-3 py-1.5 text-right font-mono tabular-nums text-secondary-300">
                                            {call ? formatBidAsk(call.bid, call.ask) : '—'}
                                        </td>

                                        {/* Call OI */}
                                        <td className="px-3 py-1.5 text-right text-secondary-300">
                                            {call ? formatOi(call.openInterest) : '—'}
                                        </td>

                                        {/* Call IV */}
                                        <td className="px-3 py-1.5 text-right text-secondary-300">
                                            {call ? formatIv(call.impliedVolatility) : '—'}
                                        </td>

                                        {/* Put Bid/Ask */}
                                        <td className="px-3 py-1.5 text-right font-mono tabular-nums text-secondary-300">
                                            {put ? formatBidAsk(put.bid, put.ask) : '—'}
                                        </td>

                                        {/* Put OI */}
                                        <td className="px-3 py-1.5 text-right text-secondary-300">
                                            {put ? formatOi(put.openInterest) : '—'}
                                        </td>

                                        {/* Put IV */}
                                        <td className="px-3 py-1.5 text-right text-secondary-300">
                                            {put ? formatIv(put.impliedVolatility) : '—'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
