import 'server-only';
import {
    readPutCallRatio,
    summarizeChainForLlm,
    type PutCallReading,
} from '@y0ngha/siglens-core';
import { isTabAllowedForSymbol } from '@/entities/ticker/api';
import {
    fetchOptionsSnapshot,
    hasOptionsMarket,
} from '@/entities/options-chain/server/optionsDataCache';
import { roundNumbersDeep } from '@/entities/bars/lib/roundIndicators';
import type { ToolExecutor } from '@/app/api/ai/chat/tools/chatTools';
import { roundMoney } from '@/app/api/ai/chat/tools/roundMoney';

/**
 * Option premiums trade in whole cents — the tool hands the model nothing
 * finer. A non-finite value (no real quote) becomes `null`, matching core's
 * "null = no two-sided quote"; a mid under half a cent rounds to `0`. Uses
 * `roundMoney` for the half-cent float bias and `-0` normalization.
 */
const toCents = (v: number | null): number | null =>
    v === null || !Number.isFinite(v) ? null : roundMoney(v, 'USD');

/**
 * Rounds the bid/ask summary's mid prices and spreads to the cent. The
 * significant-digit trim keeps `0.005` or `13.325`, and the model quoted
 * them verbatim ("half a cent", "9.5 cents") even when told to write
 * cents. Spread % stays as computed from the raw quote.
 */
function withCentPremiums(
    metrics: ReturnType<typeof summarizeChainForLlm>
): ReturnType<typeof summarizeChainForLlm> {
    return {
        ...metrics,
        topOiBidAskSummary: metrics.topOiBidAskSummary.map(q => ({
            ...q,
            callMidPrice: toCents(q.callMidPrice),
            callSpread: toCents(q.callSpread),
            putMidPrice: toCents(q.putMidPrice),
            putSpread: toCents(q.putSpread),
        })),
    };
}

/**
 * Adds `putCallReading` (which side has more open contracts) next to the ratio so
 * the model states the side instead of inverting "puts per call" (the 0.83 read
 * as "puts are 0.83 of calls, so bearish" failure). Read from the PRINTED ratio
 * (after `roundNumbersDeep`), so the side and the number the model quotes can
 * never disagree. `null` when the chain has no ratio.
 *
 * Pure function of the metrics shape: the evaluation replay calls it on a
 * recorded result.
 */
export function withPutCallReading<M extends { putCallRatio: number | null }>(
    metrics: M
): M & { putCallReading: PutCallReading | null } {
    return {
        ...metrics,
        putCallReading: readPutCallRatio(metrics.putCallRatio, 'open_interest'),
    };
}

export const getOptionsSummaryTool: ToolExecutor = async args => {
    const symbol = String(args.symbol).toUpperCase();
    // Tab-policy gate BEFORE the Yahoo options-market probe — crypto/KR
    // symbols never have an options tab, so this skips a wasted network
    // round-trip on top of matching the options page's own gate
    // (`app/[locale]/[symbol]/options/page.tsx`).
    if (!(await isTabAllowedForSymbol(symbol, 'options')))
        return { symbol, available: false, reason: 'tab_not_available' };
    if (!(await hasOptionsMarket(symbol)))
        return { symbol, available: false, reason: 'no_options_market' };
    const snapshot = await fetchOptionsSnapshot(symbol);
    if (snapshot === null)
        return { symbol, available: false, reason: 'no_snapshot' };
    // chains[0] can be a same-day (daysToExpiration 0) expiry, which makes
    // the implied-move metric null — prefer the first chain with at least
    // one day left, falling back to chains[0] if every chain expires today.
    const chain =
        snapshot.chains.find(c => c.daysToExpiration >= 1) ??
        snapshot.chains[0];
    if (chain === undefined)
        return { symbol, available: false, reason: 'no_snapshot' };
    return {
        asOf: snapshot.capturedAt,
        source: 'options snapshot (cached)',
        symbol,
        available: true,
        currency: 'USD',
        underlyingPrice: snapshot.underlyingPrice,
        expiration: chain.expirationDate,
        daysToExpiration: chain.daysToExpiration,
        // Core returns raw floats (implied move range, spreads, IV); trim them
        // to significant digits like the options analysis prompt does, then
        // round premiums to the cent.
        metrics: withPutCallReading(
            withCentPremiums(
                roundNumbersDeep(
                    summarizeChainForLlm(chain, snapshot.underlyingPrice)
                )
            )
        ),
        otherExpirations: snapshot.chains
            .filter(c => c !== chain)
            .slice(0, 3)
            .map(c => c.expirationDate),
    };
};
