'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import {
    type OptionsExpirationMetrics,
    aggregateOpenInterest,
} from '@y0ngha/siglens-core';
import {
    type ClientOptionsChain,
    toCoreOptionsChain,
} from '@/entities/options-chain/lib/clientOptionsSnapshot';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import { OpenInterestTooltip } from './utils/optionsTooltips';
import { findNearestStrikeIndex } from '@/entities/options-chain/lib/findNearestStrike';
import type { OptionsExpirationSelector } from '@/shared/lib/types';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';

const numberFormatter = new Intl.NumberFormat('en-US');

function formatOi(value: number): string {
    return numberFormatter.format(value);
}

function formatIv(value: number | null): string {
    if (value === null) return '—';
    return `${(value * 100).toFixed(1)}%`;
}

/**
 * 옵션은 미국 상장 상품뿐이라 달러·`en-US` 구분자로 고정한다(행사가·호가가 1,000을 넘는
 * 고가 종목도 `$1,050`). 로케일을 고정하므로 서버·브라우저 출력이 같다(하이드레이션 안전).
 */
const quoteFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});
/** 정수 행사가는 소수 없이(`$1,050`), 아니면 한 자리(`$102.5`). */
const strikeFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
});

function formatBidAsk(bid: number | null, ask: number | null): string {
    if (bid === null && ask === null) return '—';
    const bidStr = bid !== null ? quoteFormatter.format(bid) : '—';
    const askStr = ask !== null ? quoteFormatter.format(ask) : '—';
    return `${bidStr}/${askStr}`;
}

function formatStrike(strike: number): string {
    return strikeFormatter.format(strike);
}

interface OptionsChainTableProps {
    symbol: string;
    /** 'YYYY-MM-DD' or 'all'. Maps to the appropriate chain via the same rule as Metrics/Chart. */
    expirationDate: OptionsExpirationSelector;
    /** Spot price used to anchor the ATM-row highlight. */
    underlyingPrice: number;
    /** Chain matching the selected expiration; null when absent. */
    chain: ClientOptionsChain | null;
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
    const t = useTranslations('widgets.options');
    const tChain = useTranslations('widgets.options.chainTable');
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
        const aggregatedStrikes = aggregateOpenInterest(
            toCoreOptionsChain(chain, underlyingPrice)
        );
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
        ? tChain('chainHeaderExpanded', {
              v0: chain?.expirationDate ?? '—',
          })
        : tChain('chainHeaderCollapsed', {
              v0: numberFormatter.format(totalContracts),
          });

    if (!chain || totalContracts === 0) {
        return (
            <div
                className={cn(
                    SURFACE_CARD,
                    'flex w-full items-center justify-between p-4'
                )}
            >
                <span className="text-sm text-secondary-400">
                    {t('OptionsChainTable.1b9687')}
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
                className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-border-control bg-secondary-800 p-4 transition-colors hover:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
                <span className="text-sm text-secondary-200">
                    {headerLabel}
                </span>
            </button>

            <div id="options-chain-table" hidden={!expanded}>
                {expirationDate === 'all' && nearestExpiry && (
                    <p className="mt-2 px-1 text-[10px] text-secondary-500">
                        {t('OptionsChainTable.0300a5', { v0: nearestExpiry })}
                    </p>
                )}

                <div className="mt-2 overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                        <caption className="sr-only">
                            {t('OptionsChainTable.b2411c', {
                                v0: symbol,
                                v1: expirationDate,
                            })}
                        </caption>

                        <thead className="border-b border-secondary-700 text-xs tracking-widest text-secondary-400 uppercase">
                            <tr>
                                <th scope="col" className="px-3 py-2 text-left">
                                    Strike{' '}
                                    <InfoTooltip>
                                        <p>{tChain('strikeTooltip1')}</p>
                                        <p>{tChain('strikeTooltip2')}</p>
                                    </InfoTooltip>
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
                                        <p>{tChain('ivTooltip1')}</p>
                                        <p>{tChain('ivTooltip2')}</p>
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
                                        <td className="px-3 py-1.5 text-left font-mono whitespace-nowrap text-secondary-200 tabular-nums">
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

                                        <td className="px-3 py-1.5 text-right font-mono whitespace-nowrap text-secondary-300 tabular-nums">
                                            {call
                                                ? formatBidAsk(
                                                      call.bid,
                                                      call.ask
                                                  )
                                                : '—'}
                                        </td>

                                        <td className="px-3 py-1.5 text-right text-secondary-300">
                                            {call
                                                ? formatOi(call.openInterest)
                                                : '—'}
                                        </td>

                                        <td className="px-3 py-1.5 text-right text-secondary-300">
                                            {call
                                                ? formatIv(
                                                      call.impliedVolatility
                                                  )
                                                : '—'}
                                        </td>

                                        <td className="px-3 py-1.5 text-right font-mono whitespace-nowrap text-secondary-300 tabular-nums">
                                            {put
                                                ? formatBidAsk(put.bid, put.ask)
                                                : '—'}
                                        </td>

                                        <td className="px-3 py-1.5 text-right text-secondary-300">
                                            {put
                                                ? formatOi(put.openInterest)
                                                : '—'}
                                        </td>

                                        <td className="px-3 py-1.5 text-right text-secondary-300">
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
