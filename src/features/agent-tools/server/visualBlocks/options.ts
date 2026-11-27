import 'server-only';
import {
    aggregateOpenInterest,
    summarizeChainForLlm,
    type OptionsChain,
    type StrikeOpenInterest,
} from '@y0ngha/siglens-core';
import type { ChatOptionsBlock } from '@/entities/chat-conversation/types';
import {
    fetchOptionsSnapshot,
    hasOptionsMarket,
} from '@/entities/options-chain/server/optionsDataCache';
import { isTabAllowedForSymbol } from '@/entities/ticker/api';
import { roundTo } from '@/features/agent-tools/lib/visualBlocks/round';
import {
    noData,
    type VisualOutcome,
} from '@/features/agent-tools/lib/visualBlocks/types';

/** 기초자산가 대비 이 비율 안의 행사가만 그린다. */
export const OPTIONS_STRIKE_BAND = 0.2;
export const OPTIONS_STRIKES_MAX = 60;
/** 기본 만기: 이 일수 이상 남은 가장 가까운 만기 — 당일·주간 만기의 쏠림을 피한다. */
export const OPTIONS_DEFAULT_MIN_DTE = 7;
const TOP_STRIKES_IN_SUMMARY = 3;

/** 만기 고르기 — 지정한 만기가 있으면 그것(없으면 `null`), 아니면 7일 이상 남은 가장 가까운 만기(없으면 가장 먼 만기). */
export function pickChain(
    chains: readonly OptionsChain[],
    expiry: string | null
): OptionsChain | null {
    if (expiry !== null)
        return chains.find(c => c.expirationDate === expiry) ?? null;
    return (
        chains.find(c => c.daysToExpiration >= OPTIONS_DEFAULT_MIN_DTE) ??
        chains.at(-1) ??
        null
    );
}

/**
 * 만기 하나의 행사가별 콜·풋 미결제약정 — 기초자산가 ±20% 안, 최대 60개(기초자산가에 가까운 순으로 고른 뒤 행사가 순).
 * 미결제약정이 둘 다 0인 행은 뺀다.
 */
export function optionsStrikesFrom(
    oi: readonly StrikeOpenInterest[],
    underlyingPrice: number
): ChatOptionsBlock['strikes'] {
    return oi
        .filter(
            r =>
                Math.abs(r.strike / underlyingPrice - 1) <=
                    OPTIONS_STRIKE_BAND &&
                r.callOpenInterest + r.putOpenInterest > 0
        )
        .toSorted(
            (a, b) =>
                Math.abs(a.strike - underlyingPrice) -
                Math.abs(b.strike - underlyingPrice)
        )
        .slice(0, OPTIONS_STRIKES_MAX)
        .toSorted((a, b) => a.strike - b.strike)
        .map(r => ({
            strike: r.strike,
            callOI: r.callOpenInterest,
            putOI: r.putOpenInterest,
        }));
}

const topBy = (
    strikes: ChatOptionsBlock['strikes'],
    side: 'callOI' | 'putOI'
) =>
    strikes
        .toSorted((a, b) => b[side] - a[side])
        .slice(0, TOP_STRIKES_IN_SUMMARY)
        .map(r => ({ strike: r.strike, openInterest: r[side] }));

/** 옵션 분포 — 옵션 시장이 있는 미국 종목만. */
export async function buildOptionsBlock(
    symbol: string,
    expiry: string | null
): Promise<VisualOutcome> {
    if (!(await isTabAllowedForSymbol(symbol, 'options')))
        return noData('options_not_available_for_this_symbol');
    if (!(await hasOptionsMarket(symbol))) return noData('no_options_market');
    const snapshot = await fetchOptionsSnapshot(symbol);
    if (snapshot === null || snapshot.chains.length === 0)
        return noData('no_snapshot');
    const chain = pickChain(snapshot.chains, expiry);
    if (chain === null)
        return noData(
            `expiry_not_found; available: ${snapshot.chains
                .slice(0, 8)
                .map(c => c.expirationDate)
                .join(', ')}`
        );
    const strikes = optionsStrikesFrom(
        aggregateOpenInterest(chain),
        snapshot.underlyingPrice
    );
    if (strikes.length === 0) return noData('no_open_interest_near_the_price');
    const metrics = summarizeChainForLlm(chain, snapshot.underlyingPrice);
    const putCallRatio =
        metrics.putCallRatio === null ? null : roundTo(metrics.putCallRatio, 2);
    const block: ChatOptionsBlock = {
        version: 1,
        kind: 'options',
        asOf: snapshot.capturedAt,
        symbol,
        expiry: chain.expirationDate,
        underlyingPrice: snapshot.underlyingPrice,
        maxPain: metrics.maxPain,
        putCallRatio,
        strikes,
    };
    return {
        block,
        summary: {
            symbol,
            expiry: chain.expirationDate,
            daysToExpiration: chain.daysToExpiration,
            underlyingPrice: snapshot.underlyingPrice,
            maxPain: metrics.maxPain,
            putCallRatio,
            strikesShown: strikes.length,
            topCallOpenInterest: topBy(strikes, 'callOI'),
            topPutOpenInterest: topBy(strikes, 'putOI'),
        },
    };
}
