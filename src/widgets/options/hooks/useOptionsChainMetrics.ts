'use client';

import { useMemo } from 'react';
import {
    type OptionsExpirationMetrics,
    summarizeChainForLlm,
} from '@y0ngha/siglens-core';
import { pickActiveChain } from '@/entities/options-chain/lib/pickActiveChain';
import {
    type ClientOptionsChain,
    type ClientOptionsSnapshot,
    toCoreOptionsChain,
} from '@/entities/options-chain/lib/clientOptionsSnapshot';
import type { OptionsExpirationSelector } from '@/shared/lib/types';

export interface OptionsChainMetrics {
    /** Chain matching the selected expiration (or null when no chain exists). */
    /**
     * 선택된 만기의 체인 — 클라이언트로 투영된 모양 그대로다. 자식 위젯은 이 타입만 받으므로
     * 투영에서 뺀 필드(`contractSymbol`·`lastPrice`·`inTheMoney`)를 읽으면 타입 오류가 난다.
     */
    chain: ClientOptionsChain | null;
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
    snapshot: ClientOptionsSnapshot,
    expirationDate: OptionsExpirationSelector
): OptionsChainMetrics {
    return useMemo(() => {
        const chain = pickActiveChain(snapshot, expirationDate);
        if (!chain) return { chain: null, metrics: null };
        // core 계산만 전체 `OptionsChain`을 요구한다 — 그 호출 자리에서만 되돌린다.
        const metrics = summarizeChainForLlm(
            toCoreOptionsChain(chain, snapshot.underlyingPrice),
            snapshot.underlyingPrice
        );
        return { chain, metrics };
    }, [snapshot, expirationDate]);
}
