import 'server-only';
import { isE2E } from '@/shared/api/e2eEnv';
import { isKrEquitySymbol } from '@/shared/config/marketProfile/registry';
import { ISO_DATE_LENGTH } from '@/shared/config/time';
import { tryGetDatabaseClient } from '@/shared/db/client';
import {
    DrizzleInvestorFlowsSnapshotRepository,
    type FilerFilingRow,
    type FilerNameRow,
    type HolderPositionRow,
} from '../api/investorFlowsSnapshotRepository';
import { filerNameTokens, matchesFiler } from '../lib/filerNameMatch';
import {
    SNAPSHOT_MAX_QUARTERS,
    type AggregateRecord,
} from '../lib/snapshot/institutional';
import { clipSummaryText, SUMMARY_NAME_MAX_CHARS } from '../lib/summary/format';
import {
    HOLDER_LOOKUP_MATCHES_MAX,
    HOLDER_LOOKUP_MAX_FILERS,
    HOLDER_LOOKUP_NOTE,
    type HolderLookupMatch,
    type HolderLookupStatus,
    type HolderLookupView,
} from '../model';
import { resolveHoldersPeriod } from './resolveHoldersPeriod';

/** Filer rows the name pre-filter reads before `matchesFiler` decides (a cap on one query, not on matches). */
const FILER_CANDIDATE_LIMIT = 50;

/** The reads a lookup needs: a slice of `DrizzleInvestorFlowsSnapshotRepository`, injected so the logic is testable. */
export interface HolderLookupReads {
    findCusipsBySymbol(symbol: string): Promise<string[]>;
    findAggregates(cusip: string, limit: number): Promise<AggregateRecord[]>;
    findLatestPositionPeriod(cusip: string): Promise<string | null>;
    findFilersByNameTokens(
        tokens: readonly string[],
        limit: number
    ): Promise<FilerNameRow[]>;
    findHolderPositions(
        cusip: string,
        period: string,
        ciks: readonly number[]
    ): Promise<HolderPositionRow[]>;
    findFilerFilings(
        cusip: string,
        ciks: readonly number[],
        period: string
    ): Promise<FilerFilingRow[]>;
    countHoldersAbove(
        cusip: string,
        period: string,
        shares: number
    ): Promise<number>;
}

export interface HolderLookupInput {
    symbol: string;
    /** Already trimmed and clamped by the caller. */
    query: string;
    /** `YYYY-MM-DD`, for the period choice. */
    today: string;
    /**
     * The quarter the holder list beside this lookup was built for (the scorecard snapshot's `topHoldersPeriod`).
     * When given it is used as is, so the lookup and the cached list can never name different quarters; only
     * without it the quarter is chosen by `resolveHoldersPeriod`.
     */
    period?: string | null;
}

function view(
    input: HolderLookupInput,
    period: string | null,
    status: HolderLookupStatus,
    extra: Partial<Pick<HolderLookupView, 'matches' | 'matchedFilers'>> = {}
): HolderLookupView {
    return {
        query: input.query,
        period,
        status,
        matches: extra.matches ?? [],
        matchedFilers: extra.matchedFilers ?? [],
        note: HOLDER_LOOKUP_NOTE,
    };
}

/**
 * Status when no matching filer lists the stock. Only filers with a processed filing for the quarter count:
 * none -> `no_filing_for_period`; any whose filing was parsed before the CUSIP was mapped -> `not_determinable`
 * (its positions were filtered out of that filing, so absence proves nothing); otherwise `not_holding`.
 */
function absenceStatus(filings: readonly FilerFilingRow[]): HolderLookupStatus {
    const processed = filings.filter(f => f.processed);
    if (processed.length === 0) return 'no_filing_for_period';
    return processed.every(f => f.couldListCusip)
        ? 'not_holding'
        : 'not_determinable';
}

/**
 * One named institution's 13F position in a US stock, for the quarter the holder list uses
 * (`resolveHoldersPeriod`). Never exposes a CIK or CUSIP. Throws on a DB failure (the executor degrades it).
 */
export async function lookupHolder(
    reads: HolderLookupReads,
    input: HolderLookupInput
): Promise<HolderLookupView> {
    if (isKrEquitySymbol(input.symbol))
        return view(input, null, 'not_us_stock');
    const tokens = filerNameTokens(input.query);
    // No Latin token (a Korean-only name): nothing to match on, and no DB read is spent finding that out.
    if (tokens.length === 0) return view(input, null, 'no_matching_filer');
    const [cusip] = await reads.findCusipsBySymbol(input.symbol);
    if (cusip === undefined) return view(input, null, 'no_13f_period');
    const period =
        input.period ??
        (await resolveHoldersPeriod(
            reads,
            cusip,
            await reads.findAggregates(cusip, SNAPSHOT_MAX_QUARTERS),
            input.today
        ));
    if (period === null) return view(input, null, 'no_13f_period');

    const candidates = await reads.findFilersByNameTokens(
        tokens,
        FILER_CANDIDATE_LIMIT
    );
    const filers = candidates.filter(f => matchesFiler(tokens, f.name));
    if (filers.length === 0) return view(input, period, 'no_matching_filer');
    if (filers.length > HOLDER_LOOKUP_MAX_FILERS)
        return view(input, period, 'too_many_matches', {
            matchedFilers: filers
                .slice(0, HOLDER_LOOKUP_MAX_FILERS)
                .map(f => clipSummaryText(f.name, SUMMARY_NAME_MAX_CHARS)),
        });
    const matchedFilers = filers.map(f =>
        clipSummaryText(f.name, SUMMARY_NAME_MAX_CHARS)
    );
    const ciks = filers.map(f => f.cik);

    const positions = await reads.findHolderPositions(cusip, period, ciks);
    if (positions.length === 0) {
        const filings = await reads.findFilerFilings(cusip, ciks, period);
        return view(input, period, absenceStatus(filings), { matchedFilers });
    }
    const top = positions.slice(0, HOLDER_LOOKUP_MATCHES_MAX);
    const above = await Promise.all(
        top.map(p => reads.countHoldersAbove(cusip, period, p.shares))
    );
    const matches: HolderLookupMatch[] = top.map((p, i) => ({
        filerName: clipSummaryText(p.filerName, SUMMARY_NAME_MAX_CHARS),
        shares: p.shares,
        valueUsd: p.valueUsd,
        prevShares: p.prevShares,
        rankByShares: (above[i] ?? 0) + 1,
    }));
    return view(input, period, 'found', { matches, matchedFilers });
}

/**
 * `lookupHolder` over the real tables. E2E has no 13F rows (the fake provider models no filers), so it answers
 * `no_matching_filer` (`not_us_stock` for a Korean symbol, as in production). Throws when the database is unavailable.
 */
export async function getHolderLookup(
    symbol: string,
    query: string,
    period: string | null = null
): Promise<HolderLookupView> {
    const input = {
        symbol,
        query,
        today: new Date().toISOString().slice(0, ISO_DATE_LENGTH),
        period,
    };
    if (isE2E())
        return view(
            input,
            null,
            isKrEquitySymbol(symbol) ? 'not_us_stock' : 'no_matching_filer'
        );
    const client = tryGetDatabaseClient();
    if (client === null)
        throw new Error('[investor-flows] database unavailable');
    const repo = new DrizzleInvestorFlowsSnapshotRepository(client.db);
    return lookupHolder(
        {
            findCusipsBySymbol: s => repo.findCusipsBySymbol(s),
            findAggregates: (c, l) => repo.findAggregates(c, l),
            findLatestPositionPeriod: c => repo.findLatestPositionPeriod(c),
            findFilersByNameTokens: (t, l) => repo.findFilersByNameTokens(t, l),
            findHolderPositions: (c, p, k) => repo.findHolderPositions(c, p, k),
            findFilerFilings: (c, k, p) => repo.findFilerFilings(c, k, p),
            countHoldersAbove: (c, p, s) => repo.countHoldersAbove(c, p, s),
        },
        input
    );
}
