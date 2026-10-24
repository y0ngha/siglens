import { MS_PER_DAY } from '@/shared/config/time';
import { pctVs, roundPct2 } from './percent';

/**
 * Quarterly figures AS FILED, extracted from the SEC XBRL `companyconcept`
 * API (`data.sec.gov/api/xbrl/companyconcept/CIK…/us-gaap/<Concept>.json`).
 * Pure functions only — fetching, the CIK lookup and the Redis cache live in
 * `loadSecQuarters.ts`.
 *
 * Why this exists: the FMP income rows sometimes differ from the filing (TPR
 * FY2026-Q3 diluted EPS: FMP 1.66, the 10-Q 1.65) and compare against a
 * year-ago revenue that is not the one the filer itself printed beside it
 * (IP Q2-2026 revenue YoY: -11.28% from FMP rows, -2.25% from the 10-Q's own
 * restated comparative).
 *
 * Shape of the raw data (measured 2026-10-24): a concept is a flat list of
 * facts, ONE PER FILING THAT REPORTS THE PERIOD — a 10-Q carries its current
 * quarter, the year-to-date figure and the prior-year comparative; the next
 * year's 10-Q repeats that comparative, possibly restated. `fy`/`fp`/`form`/
 * `accn`/`filed` describe the FILING, not the fact's period, so a fact's own
 * period is only `start`/`end`. Hence a quarter is identified by its period
 * end date and the value is taken from the filing whose CURRENT period it is.
 */

/** Filing forms whose facts count. Foreign filers (20-F/6-K) never appear. */
export const SEC_QUARTER_FORMS = ['10-Q', '10-K', '10-Q/A', '10-K/A'] as const;
export type SecForm = (typeof SEC_QUARTER_FORMS)[number];

/** One fact of a concept, as the API lists it (only the fields used here). */
export interface SecConceptFact {
    start: string;
    end: string;
    val: number;
    accn: string;
    form: SecForm;
    filed: string;
}

/**
 * One fiscal quarter as filed. `revenueYoYPct` prefers the prior-year
 * comparative printed in the SAME filing (restatement-consistent) and falls
 * back to the prior-year quarter's own filed value; `null` when neither
 * exists or the base is not positive.
 *
 * `form`/`accn`/`filed` are those of the filing the EPS comes from (the
 * revenue's when there is no EPS fact). Fiscal Q4: usually no 3-month fact in
 * the 10-K, so `revenue` is derived as FY − (Q1+Q2+Q3) (only when all four
 * are consistent) and `epsDiluted` is `null` — a per-share figure is not
 * additive (share counts differ by quarter), so it is never derived.
 */
export interface SecQuarter {
    /** Fiscal period end date (`YYYY-MM-DD`). */
    periodEnd: string;
    form: SecForm;
    accn: string;
    /** Filing date (`YYYY-MM-DD`). */
    filed: string;
    epsDiluted: number | null;
    revenue: number | null;
    revenueYoYPct: number | null;
}

/** Revenue concepts to try; the one with the newest filed fact wins (companies change tags). */
export const SEC_REVENUE_CONCEPTS = [
    'Revenues',
    'RevenueFromContractWithCustomerExcludingAssessedTax',
    'SalesRevenueNet',
    'RevenueFromContractWithCustomerIncludingAssessedTax',
] as const;
export const SEC_EPS_CONCEPT = 'EarningsPerShareDiluted';
export const SEC_EPS_UNIT = 'USD/shares';
export const SEC_REVENUE_UNIT = 'USD';

/** Newest quarters kept per CIK (the tool shows 5 and needs the year-ago row of the oldest). */
export const SEC_QUARTERS_KEEP = 12;

/**
 * A fiscal quarter lasts 13–14 weeks: accepted duration in days. Longer
 * quarters (e.g. a 16-week retail Q1) are deliberately excluded: that quarter
 * gets no SEC fields, and a Q4 that would need it is not derived and stays
 * `null` — safe, never a wrong number.
 */
const QUARTER_DAYS_MIN = 80;
const QUARTER_DAYS_MAX = 100;
/** A fiscal year lasts 52–53 weeks. */
const YEAR_DAYS_MIN = 350;
const YEAR_DAYS_MAX = 380;
/** Same period one year earlier: 365 days ± this. */
const YEAR_AGO_TOLERANCE_DAYS = 10;
const DAYS_PER_YEAR = 365;
/** A provider row's period end and the SEC's differ by at most this (calendar shifts of a week). */
export const SEC_PERIOD_MATCH_DAYS = 7;
/** A quarter's start vs the previous quarter's end. */
const ADJACENT_DAYS = 5;
/** FY start vs Q1 start tolerance when checking the quarters belong to the fiscal year. */
const FY_START_TOLERANCE_DAYS = 7;

function isSecForm(value: unknown): value is SecForm {
    return SEC_QUARTER_FORMS.some(form => form === value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isIsoDate(value: unknown): value is string {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Calendar days from `b` to `a` (`YYYY-MM-DD`), may be negative. */
export function daysBetween(a: string, b: string): number {
    return Math.round((Date.parse(a) - Date.parse(b)) / MS_PER_DAY);
}

/**
 * Facts of one unit from a raw `companyconcept` body, restricted to the
 * 10-Q/10-K family. Malformed entries are dropped; an unexpected body shape
 * yields `[]` (the loader treats it as "no SEC data").
 */
export function parseConceptFacts(
    json: unknown,
    unit: string
): SecConceptFact[] {
    if (!isRecord(json) || !isRecord(json.units)) return [];
    const list = json.units[unit];
    if (!Array.isArray(list)) return [];
    return list.flatMap((raw: unknown): SecConceptFact[] => {
        if (!isRecord(raw)) return [];
        const { start, end, val, accn, form, filed } = raw;
        if (
            !isIsoDate(start) ||
            !isIsoDate(end) ||
            typeof val !== 'number' ||
            !Number.isFinite(val) ||
            typeof accn !== 'string' ||
            !isSecForm(form) ||
            !isIsoDate(filed)
        )
            return [];
        return [{ start, end, val, accn, form, filed }];
    });
}

/** The newest `filed` date across the facts, `''` when there are none. */
function newestFiled(facts: readonly SecConceptFact[]): string {
    return facts.reduce((max, f) => (f.filed > max ? f.filed : max), '');
}

/**
 * The fact list of the concept a company is CURRENTLY using: the one whose
 * newest filed fact is the newest (JBHT stopped tagging `Revenues` in 2018 and
 * now uses `RevenueFromContractWithCustomerIncludingAssessedTax`; reading the
 * stale one would show 2018 figures). A tie keeps the earlier candidate.
 */
export function pickCurrentConcept(
    candidates: readonly (readonly SecConceptFact[])[]
): readonly SecConceptFact[] {
    return candidates.reduce<readonly SecConceptFact[]>(
        (best, facts) =>
            facts.length > 0 && newestFiled(facts) > newestFiled(best)
                ? facts
                : best,
        []
    );
}

/** A quarter (or derived Q4) of ONE concept, before the EPS and revenue series are merged. */
interface SeriesEntry {
    start: string;
    end: string;
    val: number;
    accn: string;
    form: SecForm;
    filed: string;
    /** Prior-year same-quarter value printed in the SAME filing, if any. */
    comparative: number | null;
    /** `true` for a Q4 derived as FY − (Q1+Q2+Q3). */
    derived: boolean;
}

function durationDays(f: SecConceptFact): number {
    return daysBetween(f.end, f.start);
}

function isQuarterLong(f: SecConceptFact): boolean {
    const days = durationDays(f);
    return days >= QUARTER_DAYS_MIN && days <= QUARTER_DAYS_MAX;
}

function isYearLong(f: SecConceptFact): boolean {
    const days = durationDays(f);
    return days >= YEAR_DAYS_MIN && days <= YEAR_DAYS_MAX;
}

function isYearAgo(laterEnd: string, earlierEnd: string): boolean {
    return (
        Math.abs(daysBetween(laterEnd, earlierEnd) - DAYS_PER_YEAR) <=
        YEAR_AGO_TOLERANCE_DAYS
    );
}

/** `a` is the later filing (amendments supersede; the accession breaks a same-day tie). */
function isLaterFiling(
    a: Pick<SecConceptFact, 'filed' | 'accn'>,
    b: Pick<SecConceptFact, 'filed' | 'accn'>
): boolean {
    return a.filed !== b.filed ? a.filed > b.filed : a.accn > b.accn;
}

function groupByAccn(
    facts: readonly SecConceptFact[]
): Map<string, SecConceptFact[]> {
    return Map.groupBy(facts, f => f.accn);
}

/**
 * Per period end, the 3-month value from the LATEST filing that reports that
 * period as its CURRENT one. A filing's current period is the latest `end`
 * among all its facts (any duration), so restated comparatives that later
 * filings print for old quarters are never picked, while a 10-Q/A for the
 * same period replaces the original. Also returns the 10-K family's
 * fiscal-year facts (per year end, latest filing) for the Q4 derivation.
 */
function currentPeriodFacts(facts: readonly SecConceptFact[]): {
    quarters: Map<string, SeriesEntry>;
    years: Map<string, SecConceptFact>;
} {
    const quarters = new Map<string, SeriesEntry>();
    const years = new Map<string, SecConceptFact>();
    for (const group of groupByAccn(facts).values()) {
        const currentEnd = group.reduce(
            (max, f) => (f.end > max ? f.end : max),
            ''
        );
        const current = group.filter(f => f.end === currentEnd);
        const quarter = current.findLast(isQuarterLong);
        if (quarter !== undefined) {
            const previous = quarters.get(quarter.end);
            if (previous === undefined || isLaterFiling(quarter, previous)) {
                quarters.set(quarter.end, {
                    ...quarter,
                    comparative:
                        group.findLast(
                            f =>
                                isQuarterLong(f) &&
                                isYearAgo(quarter.end, f.end)
                        )?.val ?? null,
                    derived: false,
                });
            }
        }
        const year = current.findLast(isYearLong);
        if (year !== undefined) {
            const previous = years.get(year.end);
            if (previous === undefined || isLaterFiling(year, previous)) {
                years.set(year.end, year);
            }
        }
    }
    return { quarters, years };
}

/** The quarter that ends right before `next` starts (the XBRL `start` is the day after the previous end). */
function quarterEndingBefore(
    quarters: ReadonlyMap<string, SeriesEntry>,
    next: SeriesEntry | undefined
): SeriesEntry | undefined {
    if (next === undefined) return undefined;
    return [...quarters.values()].find(
        q => Math.abs(daysBetween(next.start, q.end)) <= ADJACENT_DAYS
    );
}

/**
 * Fiscal Q4 revenue = FY − (Q1+Q2+Q3), for each fiscal year end that has no
 * 3-month fact of its own. Only when the three quarters are consecutive,
 * start with the fiscal year's start, come from filings no later than the
 * 10-K, and the result is positive — otherwise the year gets no Q4 (`null`
 * SEC fields), never a guess.
 */
function deriveFourthQuarters(
    quarters: ReadonlyMap<string, SeriesEntry>,
    years: ReadonlyMap<string, SecConceptFact>
): SeriesEntry[] {
    return [...years.values()].flatMap((year): SeriesEntry[] => {
        if (quarters.has(year.end)) return [];
        // Q3 ends one quarter before the year end; each earlier quarter ends
        // right before the next one starts (the XBRL `start` is the day after).
        const q3 = [...quarters.values()].find(q => {
            const gap = daysBetween(year.end, q.end);
            return gap >= QUARTER_DAYS_MIN && gap <= QUARTER_DAYS_MAX;
        });
        const q2 = quarterEndingBefore(quarters, q3);
        const q1 = quarterEndingBefore(quarters, q2);
        if (!q1 || !q2 || !q3) return [];
        if (
            Math.abs(daysBetween(q1.start, year.start)) >
            FY_START_TOLERANCE_DAYS
        )
            return [];
        const filingOk = [q1, q2, q3].every(q => q.filed <= year.filed);
        const val = year.val - (q1.val + q2.val + q3.val);
        if (!filingOk || !(val > 0)) return [];
        return [
            {
                start: q3.end,
                end: year.end,
                val,
                accn: year.accn,
                form: year.form,
                filed: year.filed,
                comparative: null,
                derived: true,
            },
        ];
    });
}

function buildSeries(
    facts: readonly SecConceptFact[],
    deriveQ4: boolean
): Map<string, SeriesEntry> {
    const { quarters, years } = currentPeriodFacts(facts);
    if (!deriveQ4) return quarters;
    const merged = new Map(quarters);
    for (const q4 of deriveFourthQuarters(quarters, years)) {
        merged.set(q4.end, q4);
    }
    return merged;
}

function entryNear(
    series: ReadonlyMap<string, SeriesEntry>,
    laterEnd: string
): SeriesEntry | undefined {
    return [...series.values()].find(e => isYearAgo(laterEnd, e.end));
}

/**
 * Merges the diluted-EPS and revenue facts into per-quarter rows, newest
 * first, capped at {@link SEC_QUARTERS_KEEP}. Inputs are the facts of the
 * concepts already chosen (see {@link pickCurrentConcept}).
 */
export function buildSecQuarters(
    epsFacts: readonly SecConceptFact[],
    revenueFacts: readonly SecConceptFact[]
): SecQuarter[] {
    const eps = buildSeries(epsFacts, false);
    const revenue = buildSeries(revenueFacts, true);
    const ends = new Set([...eps.keys(), ...revenue.keys()]);
    return [...ends]
        .toSorted((a, b) => b.localeCompare(a))
        .slice(0, SEC_QUARTERS_KEEP)
        .flatMap((end): SecQuarter[] => {
            const e = eps.get(end);
            const r = revenue.get(end);
            const source = e ?? r;
            if (source === undefined) return [];
            const base =
                r === undefined
                    ? null
                    : (r.comparative ?? entryNear(revenue, r.end)?.val ?? null);
            return [
                {
                    periodEnd: end,
                    form: source.form,
                    accn: source.accn,
                    filed: source.filed,
                    epsDiluted: e?.val ?? null,
                    revenue: r?.val ?? null,
                    revenueYoYPct:
                        r === undefined ? null : roundPct2(pctVs(r.val, base)),
                },
            ];
        });
}

/**
 * The SEC quarter for a provider row's period end: the nearest one within
 * {@link SEC_PERIOD_MATCH_DAYS} days (providers and filers occasionally
 * disagree by a few days on a 52/53-week calendar), `null` when none is close.
 *
 * Two adjacent quarters can never both be in range: consecutive quarter ends
 * are at least `QUARTER_DAYS_MIN` days apart (the duration floor an SEC
 * quarter must pass), far more than 2 × 7, so the nearest match is the only
 * candidate and is never the wrong neighbour. Pinned by a test.
 */
export function findSecQuarter(
    quarters: readonly SecQuarter[],
    periodEnd: string
): SecQuarter | null {
    const ranked = quarters
        .map(q => ({
            q,
            gap: Math.abs(daysBetween(q.periodEnd, periodEnd)),
        }))
        .filter(({ gap }) => gap <= SEC_PERIOD_MATCH_DAYS)
        .toSorted((a, b) => a.gap - b.gap);
    return ranked[0]?.q ?? null;
}
