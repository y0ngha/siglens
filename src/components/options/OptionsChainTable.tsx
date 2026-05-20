'use client';

import { useMemo, useState } from 'react';
import {
    type OptionsSnapshot,
    aggregateOpenInterest,
    summarizeChainForLlm,
} from '@y0ngha/siglens-core';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { findNearestStrikeIndex } from '@/domain/options/findNearestStrike';
import { pickActiveChain } from '@/domain/options/pickActiveChain';
import type { OptionsExpirationSelector } from '@/domain/options/types';
import { cn } from '@/lib/cn';

interface OptionsChainTableProps {
    symbol: string;
    /** 'YYYY-MM-DD' or 'all'. Maps to the appropriate chain via the same rule as Metrics/Chart. */
    expirationDate: OptionsExpirationSelector;
    snapshot: OptionsSnapshot;
}

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

const OpenInterestTooltip = (
    <>
        <p>특정 옵션에 현재 살아있는(아직 청산 안 된) 계약 수예요.</p>
        <p>
            한쪽 가격대에 OI가 두텁다는 건 그 가격에 많은 사람이 베팅했다는
            뜻이에요.
        </p>
    </>
);

const ImpliedVolatilityTooltip = (
    <>
        <p>옵션 시장이 예측하는 미래 변동성이에요.</p>
        <p>높을수록 옵션값이 비싸지고, 불확실성이 크다는 뜻이에요.</p>
    </>
);

export function OptionsChainTable({
    symbol,
    expirationDate,
    snapshot,
}: OptionsChainTableProps) {
    const [expanded, setExpanded] = useState(false);

    const selectedChain = useMemo(
        () => pickActiveChain(snapshot, expirationDate),
        [snapshot, expirationDate]
    );

    // Hooks must run unconditionally — compute derived data even when the
    // chain is empty; only the render branches below short-circuit.
    const tableData = useMemo(() => {
        if (!selectedChain) {
            // Safe-cast: `null` literal is widened to the (number | null) union
            // shared with the success branch below, so the useMemo return type
            // stays uniform across both paths. Runtime value is genuinely null.
            return {
                rows: [],
                nearestStrike: null as number | null,
                maxPainStrike: NaN,
            };
        }
        const aggregatedStrikes = aggregateOpenInterest(selectedChain);
        const callByStrike = new Map(
            selectedChain.calls.map(c => [c.strike, c])
        );
        const putByStrike = new Map(selectedChain.puts.map(p => [p.strike, p]));
        const allStrikes = aggregatedStrikes.map(s => s.strike);
        const nearestStrikeIdx = findNearestStrikeIndex(
            allStrikes,
            snapshot.underlyingPrice
        );
        return {
            rows: aggregatedStrikes.map(({ strike }) => ({
                strike,
                call: callByStrike.get(strike),
                put: putByStrike.get(strike),
            })),
            nearestStrike:
                nearestStrikeIdx >= 0 ? allStrikes[nearestStrikeIdx] : null,
            maxPainStrike: summarizeChainForLlm(
                selectedChain,
                snapshot.underlyingPrice
            ).maxPain,
        };
    }, [selectedChain, snapshot.underlyingPrice]);

    const nearestExpiry = snapshot.chains[0]?.expirationDate ?? '';

    const isEmpty =
        !selectedChain ||
        (selectedChain.calls.length === 0 && selectedChain.puts.length === 0);

    const totalContracts = selectedChain
        ? selectedChain.calls.length + selectedChain.puts.length
        : 0;

    const headerLabel = expanded
        ? `▾ 전체 옵션 chain 테이블 (선택된 만기: ${selectedChain?.expirationDate ?? '—'})`
        : `▸ 전체 옵션 chain 테이블 보기 (${numberFormatter.format(totalContracts)} contracts)`;

    if (isEmpty || !selectedChain) {
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
                disabled={isEmpty}
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
                        종합 만기 — 가장 가까운 만기를 표시합니다 (
                        {nearestExpiry}). 다른 만기를 보려면 위 chip에서
                        선택하세요.
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
                                    !Number.isNaN(maxPainStrike) &&
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

                                        <td className="text-secondary-300 px-3 py-1.5 text-right font-mono tabular-nums">
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

                                        <td className="text-secondary-300 px-3 py-1.5 text-right font-mono tabular-nums">
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
