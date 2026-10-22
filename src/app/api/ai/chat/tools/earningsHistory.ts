import 'server-only';
import type { Bar, IncomeStatementRow } from '@y0ngha/siglens-core';
import { barDate } from './calendarChange';
import { pctVs } from './percent';

/** How many of the newest quarterly income rows `get_fundamentals` carries. */
export const RECENT_QUARTERS_COUNT = 5;

/** How many of the newest reported earnings dates get a price reaction. */
export const EARNINGS_REACTIONS_COUNT = 8;

/**
 * One quarterly income row as the model reads it (dev-2026-10-22 A6). Without
 * these the agent answered "the latest 10-Q EPS" from a web search and took a
 * fiscal Q4 figure — which sits in the annual 10-K — for a 10-Q. No filing
 * form is carried: the data does not say which form a row came from, and
 * guessing it from the quarter is wrong for foreign filers; the tool
 * description gives the model the US-filer rule instead.
 */
export interface RecentQuarterView {
    /** Fiscal period end date (`YYYY-MM-DD`). */
    periodEnd: string;
    fiscalYear: string;
    /** `Q1`…`Q4` as the filer labels its fiscal quarters. */
    period: string;
    /** SEC filing date of the row's report, when the provider gives one. */
    filingDate: string | null;
    epsDiluted: number | null;
    revenue: number | null;
    /** The currency the amounts are reported in (an ADR's is not its USD listing). */
    currency: string | null;
}

/**
 * The FMP adapter adds `filingDate` to its rows (`IncomeStatementRowWithFiling`),
 * but they reach this tool through core's `FinancialStatementsProvider` port,
 * typed as plain `IncomeStatementRow` — so read it structurally. Rows cached
 * before the field existed, and Yahoo rows, simply have none.
 */
function filingDateOf(row: IncomeStatementRow): string | null {
    return 'filingDate' in row &&
        typeof row.filingDate === 'string' &&
        row.filingDate !== ''
        ? row.filingDate
        : null;
}

/**
 * Newest-first quarterly rows, capped at {@link RECENT_QUARTERS_COUNT}. Sorted
 * here rather than trusting provider order; rows without a period end date
 * are dropped (they cannot be placed in time).
 */
export function recentQuarterRows(
    rows: readonly IncomeStatementRow[]
): RecentQuarterView[] {
    return rows
        .filter(row => row.date !== '')
        .toSorted((a, b) => b.date.localeCompare(a.date))
        .slice(0, RECENT_QUARTERS_COUNT)
        .map(row => ({
            periodEnd: row.date,
            fiscalYear: row.fiscalYear,
            period: row.period,
            filingDate: filingDateOf(row),
            epsDiluted: row.epsDiluted,
            revenue: row.revenue,
            currency: row.reportedCurrency ?? null,
        }));
}

/** One past earnings report and how the stock moved across it (dev-2026-10-22 A12). */
export interface EarningsReactionView {
    /** The report date (`YYYY-MM-DD`). */
    date: string;
    /**
     * % change from the close of the last session BEFORE `date` to the close
     * of the first session AFTER it. The window spans the report day and the
     * next session because the data has no before-open/after-close timing: a
     * pre-market report moves the stock on `date`, an after-close one on the
     * next session, and this window covers both.
     */
    movePct: number | null;
}

/**
 * Price reaction to each of the newest {@link EARNINGS_REACTIONS_COUNT}
 * reported earnings dates, newest first, from daily `bars` (oldest-first).
 * A date is skipped when the loaded bars do not have a COMPLETED session on
 * both sides of it (too old for the series, or no finished session after it
 * yet).
 *
 * `lastBarForming`: the cached daily series ends with today's live bar during
 * the session (a 60-second quote snapshot). Its close is the current price,
 * so an after-close report on D read during D+1 would otherwise get a
 * half-day "reaction"; that bar is left out instead.
 */
export function earningsReactions(
    allBars: readonly Bar[],
    reportedDates: readonly string[],
    lastBarForming: boolean
): EarningsReactionView[] {
    const bars = lastBarForming ? allBars.slice(0, -1) : allBars;
    const dates = bars.map(barDate);
    const newestFirst = [...new Set(reportedDates)].toSorted((a, b) =>
        b.localeCompare(a)
    );
    const out: EarningsReactionView[] = [];
    for (const date of newestFirst) {
        if (out.length >= EARNINGS_REACTIONS_COUNT) break;
        const afterIndex = dates.findIndex(d => d > date);
        // -1: no session after the report yet; 0: the series starts after it.
        if (afterIndex <= 0) continue;
        const beforeIndex =
            dates[afterIndex - 1] === date ? afterIndex - 2 : afterIndex - 1;
        if (beforeIndex < 0) continue;
        out.push({
            date,
            movePct: pctVs(bars[afterIndex]!.close, bars[beforeIndex]!.close),
        });
    }
    return out;
}
