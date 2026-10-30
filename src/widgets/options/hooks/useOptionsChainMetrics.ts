'use client';

import { useMemo } from 'react';
import {
    aggregateOpenInterest,
    summarizeChainForLlm,
    type OptionsExpirationMetrics,
    type StrikeOpenInterest,
} from '@y0ngha/siglens-core';
import { pickActiveChain } from '@/entities/options-chain/lib/pickActiveChain';
import {
    type ClientOptionsChain,
    type ClientOptionsSnapshot,
    toCoreOptionsChain,
} from '@/entities/options-chain/lib/clientOptionsSnapshot';
import type { OptionsExpirationSelector } from '@/shared/lib/types';

/** View models derived once per `(snapshot, expiration)` for the options tab. */
export interface OptionsChainMetrics {
    /**
     * 선택된 만기의 체인 — 클라이언트로 투영된 모양 그대로다. 자식 위젯은 이 타입만 받으므로
     * 투영에서 뺀 필드(`contractSymbol`·`lastPrice`·`inTheMoney`)를 읽으면 타입 오류가 난다.
     * 체인이 없으면 null.
     */
    chain: ClientOptionsChain | null;
    /** Aggregated metrics for the chain, or null when the chain is absent. */
    metrics: OptionsExpirationMetrics | null;
    /** Per-strike open interest sorted ascending; empty when the chain is absent. */
    oiByStrike: ReadonlyArray<StrikeOpenInterest>;
}

const EMPTY_OPTIONS_CHAIN_METRICS: OptionsChainMetrics = {
    chain: null,
    metrics: null,
    oiByStrike: [],
};

/**
 * Selector hook that derives the options tab's shared view models once.
 *
 * The metrics row, the OI chart and the chain table all need the same
 * `(chain, metrics, oiByStrike)` triple. Computing it here — converting the
 * client chain to the core chain a single time — lets `OptionsPageClient`
 * drill the result down so no child repeats `pickActiveChain`,
 * `summarizeChainForLlm` or `aggregateOpenInterest`.
 */
export function useOptionsChainMetrics(
    snapshot: ClientOptionsSnapshot,
    expirationDate: OptionsExpirationSelector
): OptionsChainMetrics {
    return useMemo(() => {
        const chain = pickActiveChain(snapshot, expirationDate);
        if (!chain) return EMPTY_OPTIONS_CHAIN_METRICS;
        // core 계산만 전체 `OptionsChain`을 요구한다 — 변환은 여기서 한 번만 한다.
        const coreChain = toCoreOptionsChain(chain, snapshot.underlyingPrice);
        return {
            chain,
            metrics: summarizeChainForLlm(coreChain, snapshot.underlyingPrice),
            oiByStrike: aggregateOpenInterest(coreChain),
        };
    }, [snapshot, expirationDate]);
}
