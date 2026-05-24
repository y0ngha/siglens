'use client';

import { useMemo } from 'react';
import {
    type OptionsChain,
    type OptionsExpirationMetrics,
    type OptionsSnapshot,
    summarizeChainForLlm,
} from '@y0ngha/siglens-core';
import { pickActiveChain } from '@/entities/options-chain';
import type { OptionsExpirationSelector } from '@/shared/lib/types';

export interface OptionsChainMetrics {
    /** Chain matching the selected expiration (or null when no chain exists). */
    chain: OptionsChain | null;
    /** Aggregated metrics for the chain, or null when the chain is absent. */
    metrics: OptionsExpirationMetrics | null;
}

/**
 * Shared selector hook for the options-tab view models.
 *
 * `OptionsMetricsRow`, `OpenInterestChart`, and `OptionsChainTable` all needed
 * the same `(chain, metrics)` pair, and previously each re-derived it via its
 * own `useMemo`. On every chip switch the same `pickActiveChain` +
 * `summarizeChainForLlm` chain ran three times against identical inputs.
 *
 * Centralising the derivation here lets `OptionsPageClient` compute the pair
 * once per `(snapshot, expirationDate)` change and drill the result down to
 * the three children — the three components stop knowing about the helpers
 * altogether.
 */
export function useOptionsChainMetrics(
    snapshot: OptionsSnapshot,
    expirationDate: OptionsExpirationSelector
): OptionsChainMetrics {
    return useMemo(() => {
        const chain = pickActiveChain(snapshot, expirationDate);
        if (!chain) return { chain: null, metrics: null };
        const metrics = summarizeChainForLlm(chain, snapshot.underlyingPrice);
        return { chain, metrics };
    }, [snapshot, expirationDate]);
}
