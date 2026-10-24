import 'server-only';
import type { Bar, IncomeStatementRow } from '@y0ngha/siglens-core';
import { barDate } from './calendarChange';
import { pctVs } from './percent';

/** Fiscal quarters in a year — the look-back to a quarter's year-ago row. */
const QUARTERS_PER_YEAR = 4;

/** How many of the newest quarterly income rows `get_fundamentals` carries. */
export const RECENT_QUARTERS_COUNT = 5;

/**
 * Quarterly rows requested from the provider: the five shown plus the four
 * before them, so the oldest shown quarter still finds its year-ago row for
 * `revenueYoYPct`. The provider applies `limit` as a slice of one cached list,
 * so asking for more costs no extra FMP call.
 */
export const QUARTERS_FETCH_COUNT = RECENT_QUARTERS_COUNT + QUARTERS_PER_YEAR;

/** How many of the newest reported earnings dates get a price reaction. */
export const EARNINGS_REACTIONS_COUNT = 8;

/**
 * One quarterly income row as the model reads it (dev-2026-10-22 A6). Without
 * these the agent answered "the latest 10-Q EPS" from a web search and took a
 * fiscal Q4 figure — which sits in the annual 10-K — for a 10-Q.
 *
 * `form` is DERIVED from the fiscal quarter label, not read from the data (the
 * provider rows carry no form type): Q4 → `10-K`, Q1–Q3 → `10-Q`, anything
 * else (`FY`, unknown) → `null`. It applies only to US domestic SEC filers;
 * it is `null` for Korean stocks (no SEC filing at all) and for foreign
 * issuers (20-F/6-K, no 10-Q/10-K). The profile carries no country/exchange
 * field, so a foreign issuer is detected only by its rows' reporting currency
 * being a non-USD one (an ADR reports in its home currency, e.g. TSM in TWD).
 * LIMITATION: a foreign filer that reports in USD, or rows with no currency,
 * are not detectable and still get the derived form.
 *
 * `revenueYoYPct` compares with the SAME fiscal quarter one fiscal year
 * earlier, looked up in the full row set (not just the five newest shown, or
 * the newest quarters would never find their year-ago row).
 */
export interface RecentQuarterView {
    /** Fiscal period end date (`YYYY-MM-DD`). */
    periodEnd: string;
    fiscalYear: string;
    /** `Q1`…`Q4` as the filer labels its fiscal quarters. */
    period: string;
    /** Filing form implied by `period` (see above); `null` when the label is not a fiscal quarter. */
    form: '10-Q' | '10-K' | null;
    /** SEC filing date of the row's report, when the provider gives one. */
    filingDate: string | null;
    epsDiluted: number | null;
    revenue: number | null;
    /** % change vs the same fiscal quarter one year earlier, 2 decimals; `null` when that row or either revenue is missing, or the base is not positive. */
    revenueYoYPct: number | null;
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

/** `revenueYoYPct` is contracted at 2 decimals (`pctVs` itself keeps 4). */
const PCT_ROUND_FACTOR = 10 ** 2;

/** `pctVs` keeps 4 decimals; this field is contracted at 2. */
function round2(pct: number | null): number | null {
    return pct === null
        ? null
        : Math.round(pct * PCT_ROUND_FACTOR) / PCT_ROUND_FACTOR;
}

function filingFormOf(
    row: IncomeStatementRow,
    isKrEquity: boolean
): RecentQuarterView['form'] {
    const currency = row.reportedCurrency ?? null;
    if (isKrEquity || (currency !== null && currency !== 'USD')) return null;
    const period = row.period;
    if (period === 'Q4') return '10-K';
    return period === 'Q1' || period === 'Q2' || period === 'Q3'
        ? '10-Q'
        : null;
}

/** Revenue of the same fiscal quarter in the previous fiscal year, `null` when there is no such row. */
function yearAgoRevenue(
    rows: readonly IncomeStatementRow[],
    row: IncomeStatementRow
): number | null {
    const year = Number(row.fiscalYear);
    if (!Number.isInteger(year)) return null;
    const prior = rows.find(
        r => r.period === row.period && Number(r.fiscalYear) === year - 1
    );
    return prior?.revenue ?? null;
}

/**
 * Newest-first quarterly rows, capped at {@link RECENT_QUARTERS_COUNT}. Sorted
 * here rather than trusting provider order; rows without a period end date
 * are dropped (they cannot be placed in time).
 */
export function recentQuarterRows(
    rows: readonly IncomeStatementRow[],
    isKrEquity = false
): RecentQuarterView[] {
    return rows
        .filter(row => row.date !== '')
        .toSorted((a, b) => b.date.localeCompare(a.date))
        .slice(0, RECENT_QUARTERS_COUNT)
        .map(row => ({
            periodEnd: row.date,
            fiscalYear: row.fiscalYear,
            period: row.period,
            form: filingFormOf(row, isKrEquity),
            filingDate: filingDateOf(row),
            epsDiluted: row.epsDiluted,
            revenue: row.revenue,
            revenueYoYPct: round2(
                pctVs(row.revenue, yearAgoRevenue(rows, row))
            ),
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
    return newestFirst
        .flatMap((date): EarningsReactionView[] => {
            const afterIndex = dates.findIndex(d => d > date);
            // -1: no session after the report yet; 0: the series starts after it.
            if (afterIndex <= 0) return [];
            const beforeIndex =
                dates[afterIndex - 1] === date
                    ? afterIndex - 2
                    : afterIndex - 1;
            if (beforeIndex < 0) return [];
            return [
                {
                    date,
                    movePct: pctVs(
                        bars[afterIndex]!.close,
                        bars[beforeIndex]!.close
                    ),
                },
            ];
        })
        .slice(0, EARNINGS_REACTIONS_COUNT);
}
