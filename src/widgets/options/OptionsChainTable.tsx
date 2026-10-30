'use client';

/**
 * Collapsible options chain table (one row per strike, call and put sides).
 * Row data comes from `buildChainTableModel`; cell text from `chainTableFormat`.
 */
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import type {
    OptionsExpirationMetrics,
    StrikeOpenInterest,
} from '@y0ngha/siglens-core';
import type { ClientOptionsChain } from '@/entities/options-chain/lib/clientOptionsSnapshot';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import { OpenInterestTooltip } from './utils/optionsTooltips';
import {
    formatBidAsk,
    formatIv,
    formatOi,
    formatStrike,
} from './utils/chainTableFormat';
import { buildChainTableModel } from './utils/chainTableModel';
import type { OptionsExpirationSelector } from '@/shared/lib/types';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';

interface OptionsChainTableProps {
    symbol: string;
    /** 'YYYY-MM-DD' or 'all'. Maps to the appropriate chain via the same rule as Metrics/Chart. */
    expirationDate: OptionsExpirationSelector;
    /** Spot price used to anchor the ATM-row highlight. */
    underlyingPrice: number;
    /** Chain matching the selected expiration; null when absent. */
    chain: ClientOptionsChain | null;
    /** Per-strike OI for the chain (row order); empty when the chain is absent. */
    oiByStrike: ReadonlyArray<StrikeOpenInterest>;
    /** Pre-computed metrics; `maxPain` drives the 📍 row marker. */
    metrics: OptionsExpirationMetrics | null;
    /** `true` when the OI snapshot is stale: Max Pain is untrustworthy, so no 📍 marker. */
    oiStale: boolean;
    /** First-chain expiration date for the "종합 만기" caption. */
    nearestExpiry: string;
}

/** strike별 콜·풋 체인 표 — 기본은 접혀 있고, 현재가 근처 행과 Max Pain 행을 표시한다. */
export function OptionsChainTable({
    symbol,
    expirationDate,
    underlyingPrice,
    chain,
    oiByStrike,
    metrics,
    oiStale,
    nearestExpiry,
}: OptionsChainTableProps) {
    const t = useTranslations('widgets.options');
    const tChain = useTranslations('widgets.options.chainTable');
    const [expanded, setExpanded] = useState(false);

    const maxPain = oiStale ? null : (metrics?.maxPain ?? null);
    // Hooks must run unconditionally — the empty-chain branches render below.
    const tableData = useMemo(
        () => buildChainTableModel(chain, oiByStrike, maxPain, underlyingPrice),
        [chain, oiByStrike, maxPain, underlyingPrice]
    );

    const totalContracts = chain ? chain.calls.length + chain.puts.length : 0;

    const headerLabel = expanded
        ? tChain('chainHeaderExpanded', {
              v0: chain?.expirationDate ?? '-',
          })
        : tChain('chainHeaderCollapsed', {
              v0: formatOi(totalContracts),
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
                                v1: chain.expirationDate,
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
                                                : '-'}
                                        </td>

                                        <td className="px-3 py-1.5 text-right text-secondary-300">
                                            {call
                                                ? formatOi(call.openInterest)
                                                : '-'}
                                        </td>

                                        <td className="px-3 py-1.5 text-right text-secondary-300">
                                            {call
                                                ? formatIv(
                                                      call.impliedVolatility
                                                  )
                                                : '-'}
                                        </td>

                                        <td className="px-3 py-1.5 text-right font-mono whitespace-nowrap text-secondary-300 tabular-nums">
                                            {put
                                                ? formatBidAsk(put.bid, put.ask)
                                                : '-'}
                                        </td>

                                        <td className="px-3 py-1.5 text-right text-secondary-300">
                                            {put
                                                ? formatOi(put.openInterest)
                                                : '-'}
                                        </td>

                                        <td className="px-3 py-1.5 text-right text-secondary-300">
                                            {put
                                                ? formatIv(
                                                      put.impliedVolatility
                                                  )
                                                : '-'}
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
