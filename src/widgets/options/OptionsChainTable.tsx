'use client';

import { useMemo, useState } from 'react';
import {
    type OptionsChain,
    type OptionsExpirationMetrics,
    aggregateOpenInterest,
} from '@y0ngha/siglens-core';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import { OpenInterestTooltip } from './utils/optionsTooltips';
import { findNearestStrikeIndex } from '@/entities/options-chain';
import type { OptionsExpirationSelector } from '@/shared/lib/types';
import { cn } from '@/shared/lib/cn';

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

const StrikeTooltip = (
    <>
        <p>옵션 계약에 정해진 매수/매도 가격이에요.</p>
        <p>
            콜은 &apos;이 가격에 살 권리&apos;, 풋은 &apos;이 가격에 팔
            권리&apos;를 가진다는 뜻이에요.
        </p>
    </>
);

const ImpliedVolatilityTooltip = (
    <>
        <p>옵션 시장이 예측하는 미래 변동성이에요.</p>
        <p>높을수록 옵션값이 비싸지고, 불확실성이 크다는 뜻이에요.</p>
    </>
);

interface OptionsChainTableProps {
    symbol: string;
    /** 'YYYY-MM-DD' or 'all'. Maps to the appropriate chain via the same rule as Metrics/Chart. */
    expirationDate: OptionsExpirationSelector;
    /** Spot price used to anchor the ATM-row highlight. */
    underlyingPrice: number;
    /** Chain matching the selected expiration; null when absent. */
    chain: OptionsChain | null;
    /** Pre-computed metrics; `maxPain` drives the 📍 row marker. */
    metrics: OptionsExpirationMetrics | null;
    /** First-chain expiration date for the "종합 만기" caption. */
    nearestExpiry: string;
}

export function OptionsChainTable({
    symbol,
    expirationDate,
    underlyingPrice,
    chain,
    metrics,
    nearestExpiry,
}: OptionsChainTableProps) {
    const [expanded, setExpanded] = useState(false);

    // Hooks must run unconditionally — compute derived data even when the
    // chain is empty; only the render branches below short-circuit.
    const tableData = useMemo(() => {
        if (!chain) {
            // Safe-cast: `null` literal is widened to the (number | null) union
            // shared with the success branch below, so the useMemo return type
            // stays uniform across both paths. Runtime value is genuinely null.
            // siglens-core R12: maxPainStrike is `number | null` (was `number`
            // with NaN sentinel), so the fallback aligns with the new contract.
            return {
                rows: [],
                nearestStrike: null as number | null,
                maxPainStrike: null as number | null,
            };
        }
        const aggregatedStrikes = aggregateOpenInterest(chain);
        const callByStrike = new Map(chain.calls.map(c => [c.strike, c]));
        const putByStrike = new Map(chain.puts.map(p => [p.strike, p]));
        const allStrikes = aggregatedStrikes.map(s => s.strike);
        const nearestStrikeIdx = findNearestStrikeIndex(
            allStrikes,
            underlyingPrice
        );
        return {
            rows: aggregatedStrikes.map(({ strike }) => ({
                strike,
                call: callByStrike.get(strike),
                put: putByStrike.get(strike),
            })),
            nearestStrike:
                nearestStrikeIdx >= 0 ? allStrikes[nearestStrikeIdx] : null,
            maxPainStrike: metrics?.maxPain ?? null,
        };
    }, [chain, metrics, underlyingPrice]);

    const totalContracts = chain ? chain.calls.length + chain.puts.length : 0;

    const headerLabel = expanded
        ? `▾ 전체 옵션 chain 테이블 (선택된 만기: ${chain?.expirationDate ?? '—'})`
        : `▸ 전체 옵션 chain 테이블 보기 (${numberFormatter.format(totalContracts)} contracts)`;

    if (!chain || totalContracts === 0) {
        return (
            <div className="border-secondary-700 bg-secondary-800 flex w-full items-center justify-between rounded-xl border p-4">
                <span className="text-secondary-400 text-sm">
                    ▸ 전체 옵션 chain 테이블 보기 (0 contracts)
                </span>
            </div>
        );
    }

    const { rows, nearestStrike, maxPainStrike } = tableData;

    return (
        <div>
            <button
                type="button"
                aria-expanded={expanded}
                aria-controls="options-chain-table"
                onClick={() => setExpanded(prev => !prev)}
                className="border-secondary-700 bg-secondary-800 hover:border-primary-500 focus-visible:ring-primary-500 flex w-full cursor-pointer items-center justify-between rounded-xl border p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
                <span className="text-secondary-200 text-sm">
                    {headerLabel}
                </span>
            </button>

            <div id="options-chain-table" hidden={!expanded}>
                {expirationDate === 'all' && nearestExpiry && (
                    <p className="text-secondary-500 mt-2 px-1 text-[10px]">
                        전체 만기 합산 — 가장 가까운 만기({nearestExpiry}) 기준
                        으로 표시합니다. 다른 만기를 보려면 위 만기 버튼에서
                        선택해 주세요.
                    </p>
                )}

                <div className="mt-2 overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                        <caption className="sr-only">
                            {symbol} {expirationDate} 옵션 chain (Strike별 콜/풋
                            가격, OI, IV)
                        </caption>

                        <thead className="text-secondary-400 border-secondary-700 border-b text-xs tracking-widest uppercase">
                            <tr>
                                <th scope="col" className="px-3 py-2 text-left">
                                    Strike{' '}
                                    <InfoTooltip>{StrikeTooltip}</InfoTooltip>
                                </th>
                                <th
                                    scope="col"
                                    className="px-3 py-2 text-right"
                                >
                                    Call (Bid/Ask)
                                </th>
                                <th
                                    scope="col"
                                    className="px-3 py-2 text-right"
                                >
                                    Call OI{' '}
                                    <InfoTooltip>
                                        {OpenInterestTooltip}
                                    </InfoTooltip>
                                </th>
                                <th
                                    scope="col"
                                    className="px-3 py-2 text-right"
                                >
                                    Call IV{' '}
                                    <InfoTooltip>
                                        {ImpliedVolatilityTooltip}
                                    </InfoTooltip>
                                </th>
                                <th
                                    scope="col"
                                    className="px-3 py-2 text-right"
                                >
                                    Put (Bid/Ask)
                                </th>
                                <th
                                    scope="col"
                                    className="px-3 py-2 text-right"
                                >
                                    Put OI
                                </th>
                                <th
                                    scope="col"
                                    className="px-3 py-2 text-right"
                                >
                                    Put IV
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {rows.map(({ strike, call, put }) => {
                                const isAtm = strike === nearestStrike;
                                const isMaxPain =
                                    maxPainStrike !== null &&
                                    strike === maxPainStrike;

                                return (
                                    <tr
                                        key={strike}
                                        className={cn(
                                            isAtm && 'bg-primary-500/10'
                                        )}
                                    >
                                        <td className="text-secondary-200 px-3 py-1.5 text-left font-mono whitespace-nowrap tabular-nums">
                                            {formatStrike(strike)}
                                            {isMaxPain && (
                                                <>
                                                    {' '}
                                                    <span aria-hidden="true">
                                                        📍
                                                    </span>
                                                    <span className="sr-only">
                                                        Max Pain
                                                    </span>
                                                </>
                                            )}
                                        </td>

                                        <td className="text-secondary-300 px-3 py-1.5 text-right font-mono whitespace-nowrap tabular-nums">
                                            {call
                                                ? formatBidAsk(
                                                      call.bid,
                                                      call.ask
                                                  )
                                                : '—'}
                                        </td>

                                        <td className="text-secondary-300 px-3 py-1.5 text-right">
                                            {call
                                                ? formatOi(call.openInterest)
                                                : '—'}
                                        </td>

                                        <td className="text-secondary-300 px-3 py-1.5 text-right">
                                            {call
                                                ? formatIv(
                                                      call.impliedVolatility
                                                  )
                                                : '—'}
                                        </td>

                                        <td className="text-secondary-300 px-3 py-1.5 text-right font-mono whitespace-nowrap tabular-nums">
                                            {put
                                                ? formatBidAsk(put.bid, put.ask)
                                                : '—'}
                                        </td>

                                        <td className="text-secondary-300 px-3 py-1.5 text-right">
                                            {put
                                                ? formatOi(put.openInterest)
                                                : '—'}
                                        </td>

                                        <td className="text-secondary-300 px-3 py-1.5 text-right">
                                            {put
                                                ? formatIv(
                                                      put.impliedVolatility
                                                  )
                                                : '—'}
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
