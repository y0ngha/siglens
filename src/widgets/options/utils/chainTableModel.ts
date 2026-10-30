/**
 * View-model builder for the options chain table: one row per strike joined
 * with its call and put contract, plus the ATM and Max Pain strikes to mark.
 */
import type { StrikeOpenInterest } from '@y0ngha/siglens-core';
import type {
    ClientOptionsChain,
    ClientOptionsContract,
} from '@/entities/options-chain/lib/clientOptionsSnapshot';
import { findNearestStrikeIndex } from '@/entities/options-chain/lib/findNearestStrike';

/** One strike row; a side is undefined when that side lists no contract. */
export interface ChainTableRow {
    strike: number;
    call: ClientOptionsContract | undefined;
    put: ClientOptionsContract | undefined;
}

/** Rows and the strikes that get a marker. */
export interface ChainTableModel {
    rows: ReadonlyArray<ChainTableRow>;
    /** Strike nearest the spot price (ATM highlight), or null when no rows. */
    nearestStrike: number | null;
    /** Strike carrying the Max Pain marker, or null to draw none. */
    maxPainStrike: number | null;
}

const EMPTY_CHAIN_TABLE_MODEL: ChainTableModel = {
    rows: [],
    nearestStrike: null,
    maxPainStrike: null,
};

/**
 * Build the table model. Row order follows `oiByStrike` (ascending strike).
 * Pass `maxPain: null` to omit the Max Pain marker.
 */
export function buildChainTableModel(
    chain: ClientOptionsChain | null,
    oiByStrike: ReadonlyArray<StrikeOpenInterest>,
    maxPain: number | null,
    underlyingPrice: number
): ChainTableModel {
    if (!chain) return EMPTY_CHAIN_TABLE_MODEL;

    const callByStrike = new Map(chain.calls.map(c => [c.strike, c]));
    const putByStrike = new Map(chain.puts.map(p => [p.strike, p]));
    const strikes = oiByStrike.map(row => row.strike);
    const nearestIdx = findNearestStrikeIndex(strikes, underlyingPrice);

    return {
        rows: strikes.map(strike => ({
            strike,
            call: callByStrike.get(strike),
            put: putByStrike.get(strike),
        })),
        nearestStrike: strikes[nearestIdx] ?? null,
        maxPainStrike: maxPain,
    };
}
