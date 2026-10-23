import 'server-only';
import {
    type CalendarImpact,
    computeYieldSpread,
    type EconomicCalendarEvent,
    type EconomySnapshot,
    selectCalendarEvents,
    type TreasuryRateSnapshot,
} from '@y0ngha/siglens-core';
import { getEconomicCalendarRange } from '@/entities/economy/api/economicCalendarRangeCache';
import { getEconomySnapshotStatic } from '@/entities/economy/api/economySnapshotStaticCache';
import { SNAPSHOT_CALENDAR_WINDOW_DAYS } from '@/entities/economy/api/economySnapshotCache';
import {
    type FreshTreasuryRates,
    getFreshTreasuryRates,
    TREASURY_CACHE_TTL_SECONDS,
    TREASURY_FALLBACK_TTL_SECONDS,
} from '@/entities/economy/api/treasuryRatesCache';
import { peekMacroBriefingStatic } from '@/entities/economy/api/macroBriefingStaticCache';
import { macroBriefingDayKey } from '@/entities/economy/lib/macroBriefingDayKey';
import { getKrIndicatorCards } from '@/entities/economy/api/getKrIndicatorCards';
import { getCalendarFromDb } from '@/entities/economy/api/getCalendarFromDb';
import {
    CALENDAR_COUNTRY,
    CALENDAR_COUNTRY_KR,
    type CalendarCountry,
} from '@/entities/economy/lib/economyCalendarConstants';
import {
    etDateOf,
    futureWindowEnd,
} from '@/entities/economy/lib/calendarWindow';
import { addUtcIsoDays } from '@/shared/lib/isoDate';
import {
    ECONOMY_CALENDAR_DEFAULT_DAYS,
    ECONOMY_CALENDAR_FETCH_PAD_DAYS,
    ECONOMY_CALENDAR_MAX_RANGE_DAYS,
} from '@/shared/config/economyCalendar';
import {
    MS_PER_HOUR,
    SECONDS_PER_HOUR,
    SECONDS_PER_MINUTE,
} from '@/shared/config/time';
import { fmpCalendarDateTimeToIso } from '@/shared/lib/etTimeUtils';
import type { ToolExecutor } from '@/app/api/ai/chat/tools/chatTools';
import { roundNumber } from '@/entities/bars/lib/roundIndicators';
import { ppDelta } from './percent';
import { logToolDegrade } from './logToolDegrade';

/**
 * Calendar cap. `selectCalendarEvents` (core) keeps every rate decision, then
 * fills by impact, so the cap only decides how many Medium/Low rows survive:
 * the 70-day default window held ~70 High events on 2026-10-23. Size:
 * `ECONOMY_RESULT_MAX_CHARS` (`truncate.ts`).
 */
const CALENDAR_MAX_EVENTS = 80;

/**
 * How far back and ahead of today a ranged call may reach. Back: FMP answers
 * 402 ("Premium Query Parameter") once `from` or `to` is more than about a
 * year old (2026-10-24 measured: 2025-10-25 served, 2025-10-24 refused), so
 * 360 days leaves room for the one-day read padding and the ET/UTC date gap.
 * Ahead: FMP lists major events only ~5 months out, and each distinct range is
 * its own FMP read.
 */
const RANGE_MAX_PAST_DAYS = 360;
const RANGE_MAX_FUTURE_DAYS = 365;

const DATE_ARG = /^\d{4}-\d{2}-\d{2}$/;

interface CalendarRange {
    from: string;
    to: string;
}

interface ArgIssue {
    path: 'country' | 'from' | 'to';
    message: string;
}

/** `country` argument → calendar country code. Absent means the US (the spec's default). */
const COUNTRY_ARG = {
    us: CALENDAR_COUNTRY,
    kr: CALENDAR_COUNTRY_KR,
} as const satisfies Record<string, CalendarCountry>;

type CountryLabel = keyof typeof COUNTRY_ARG;

function isCountryLabel(value: unknown): value is CountryLabel {
    // `Object.hasOwn`, not `in`/indexing: 'constructor' or '__proto__' would
    // otherwise pass as a country.
    return typeof value === 'string' && Object.hasOwn(COUNTRY_ARG, value);
}

/** The chosen country and its label; every result names the label it answered for. */
function parseCountryArg(
    value: unknown
):
    | { ok: true; country: CalendarCountry; label: CountryLabel }
    | { ok: false; issue: ArgIssue } {
    if (value === undefined)
        return { ok: true, country: CALENDAR_COUNTRY, label: 'us' };
    if (!isCountryLabel(value))
        return {
            ok: false,
            issue: { path: 'country', message: "expected 'us' or 'kr'" },
        };
    return { ok: true, country: COUNTRY_ARG[value], label: value };
}

type CalendarEventView = EconomicCalendarEvent & { hoursUntil: number };

/** The `calendar` block of a `get_economy` result. */
interface CalendarBlock {
    coverage: CalendarRange;
    events: CalendarEventView[];
    omitted: Record<CalendarImpact, number>;
    /** Set when the block came from a fallback instead of the range read. */
    fallback?: string;
}

/** A real calendar date in `YYYY-MM-DD` (`2026-02-30` fails the round trip). */
function isDateArg(value: unknown): value is string {
    return (
        typeof value === 'string' &&
        DATE_ARG.test(value) &&
        addUtcIsoDays(value, 0) === value
    );
}

/** `null` range = the default window; `from` and `to` come as a pair. */
function parseRangeArgs(
    args: Record<string, unknown>,
    today: string
):
    | { ok: true; range: CalendarRange | null }
    | { ok: false; issues: ArgIssue[] } {
    const { from, to } = args;
    if (from === undefined && to === undefined)
        return { ok: true, range: null };
    if (!isDateArg(from) || !isDateArg(to)) {
        const issues: ArgIssue[] = [];
        if (!isDateArg(from))
            issues.push({ path: 'from', message: 'expected YYYY-MM-DD' });
        if (!isDateArg(to))
            issues.push({ path: 'to', message: 'expected YYYY-MM-DD' });
        return { ok: false, issues };
    }
    const range: CalendarRange = { from, to };
    if (range.from > range.to)
        return {
            ok: false,
            issues: [{ path: 'to', message: 'must not be before from' }],
        };
    if (addUtcIsoDays(range.from, ECONOMY_CALENDAR_MAX_RANGE_DAYS) < range.to)
        return {
            ok: false,
            issues: [
                {
                    path: 'to',
                    message: `at most ${ECONOMY_CALENDAR_MAX_RANGE_DAYS} days after from`,
                },
            ],
        };
    if (range.from < addUtcIsoDays(today, -RANGE_MAX_PAST_DAYS))
        return {
            ok: false,
            issues: [
                {
                    path: 'from',
                    message: `at most ${RANGE_MAX_PAST_DAYS} days before today`,
                },
            ],
        };
    if (range.to > addUtcIsoDays(today, RANGE_MAX_FUTURE_DAYS))
        return {
            ok: false,
            issues: [
                {
                    path: 'to',
                    message: `at most ${RANGE_MAX_FUTURE_DAYS} days after today`,
                },
            ],
        };
    return { ok: true, range };
}

/**
 * The calendar block: `coverage` (the dates read), the picked events with ISO
 * dates and `hoursUntil` (negative = already released), and `omitted` per
 * impact so the model can tell "not listed" from "nothing scheduled".
 *
 * Dates go through `fmpCalendarDateTimeToIso` (FMP sends UTC with no zone
 * marker; see its JSDoc) so core can localize them to the user's zone.
 */
function calendarBlock(
    rows: readonly EconomicCalendarEvent[],
    coverage: CalendarRange,
    now: number,
    notBefore: Date
): CalendarBlock {
    const { events, omitted } = selectCalendarEvents(rows, {
        max: CALENDAR_MAX_EVENTS,
        notBefore,
    });
    return {
        coverage,
        events: events.map(e => {
            const date = fmpCalendarDateTimeToIso(e.date);
            return {
                ...e,
                date,
                hoursUntil: Math.round(
                    (new Date(date).getTime() - now) / MS_PER_HOUR
                ),
            };
        }),
        omitted,
    };
}

/**
 * Reads `range` widened by `ECONOMY_CALENDAR_FETCH_PAD_DAYS`; `null` (logged) on failure.
 * `notBefore` defaults to the start of the widened read — it also drops a row
 * whose date cannot be parsed.
 */
function readCalendar(
    country: CalendarCountry,
    range: CalendarRange,
    now: number,
    notBefore?: Date
): Promise<CalendarBlock | null> {
    const fetchFrom = addUtcIsoDays(
        range.from,
        -ECONOMY_CALENDAR_FETCH_PAD_DAYS
    );
    return getEconomicCalendarRange(
        country,
        fetchFrom,
        addUtcIsoDays(range.to, ECONOMY_CALENDAR_FETCH_PAD_DAYS)
    )
        .then(rows =>
            calendarBlock(
                rows,
                range,
                now,
                notBefore ?? new Date(`${fetchFrom}T00:00:00Z`)
            )
        )
        .catch((error: unknown) => {
            logToolDegrade('get_economy', 'economic calendar', error);
            return null;
        });
}

/** `'up' | 'down' | 'unchanged'`, or `null` when `change` itself is `null` (spec §0 null rule). */
function directionOf(
    change: number | null
): 'up' | 'down' | 'unchanged' | null {
    if (change === null) return null;
    if (change > 0) return 'up';
    if (change < 0) return 'down';
    return 'unchanged';
}

interface PickedTreasury {
    treasury: TreasuryRateSnapshot;
    fetchedAt: string | null;
    /** 같은 날 읽기의 출처. 스냅샷 값은 출처를 기록하지 않아 `null`. */
    source: FreshTreasuryRates['source'] | null;
    /** 같은 날 읽기가 재무부를 못 읽어 FMP로 물러난 값인가(짧게만 캐시된다). */
    fallback: boolean;
}

const TREASURY_SOURCE_LABEL = {
    'us-treasury': 'US Treasury',
    fmp: 'FMP',
} as const;

/**
 * Picks the treasury reading to report: the separately cached same-day read
 * (`getFreshTreasuryRates`, 3h TTL keyed by the ET date) when it is available and
 * not older than the snapshot's, else the snapshot's copy. The snapshot sits behind
 * two stacked 24h caches and served a 10y yield ~48h old.
 */
function pickTreasury(
    snapshotTreasury: TreasuryRateSnapshot | null,
    fresh: FreshTreasuryRates | null
): PickedTreasury | null {
    if (
        fresh &&
        (!snapshotTreasury || fresh.treasury.date >= snapshotTreasury.date)
    ) {
        return {
            treasury: fresh.treasury,
            fetchedAt: fresh.fetchedAt,
            source: fresh.source,
            fallback: !fresh.officialAvailable,
        };
    }
    return snapshotTreasury
        ? {
              treasury: snapshotTreasury,
              fetchedAt: null,
              source: null,
              fallback: false,
          }
        : null;
}

/**
 * `treasury` + the 2s10s spread and an inversion flag, so the model reads the curve shape instead of subtracting yields itself — `computeYieldSpread` is core's own rule, reused rather than reimplemented.
 *
 * `date` is the rate's as-of date (the provider's row date). `fetchedAt` is when
 * the same-day read hit the provider; `null` means the value came from the
 * day-cached economy snapshot and may be up to ~48h old, which `cache` states.
 */
function treasuryView(picked: PickedTreasury | null) {
    if (!picked) return null;
    const { treasury, fetchedAt, source, fallback } = picked;
    const rawSpread = computeYieldSpread(treasury);
    // `10y − 2y` in binary floats reads 0.39999999999999947; round like every
    // other number the agent quotes.
    const spread2s10s = rawSpread === null ? null : roundNumber(rawSpread);
    return {
        ...treasury,
        spread2s10s,
        curveInverted: spread2s10s === null ? null : spread2s10s < 0,
        fetchedAt,
        ...(source === null ? {} : { provider: TREASURY_SOURCE_LABEL[source] }),
        cache:
            fetchedAt === null
                ? 'economy snapshot (up to ~48h old)'
                : fallback
                  ? `FMP fallback (US Treasury unavailable; ${TREASURY_FALLBACK_TTL_SECONDS / SECONDS_PER_MINUTE}-min cache; FMP can lag the Treasury by ~2 days)`
                  : `treasury rates (${TREASURY_CACHE_TTL_SECONDS / SECONDS_PER_HOUR}h cache)`,
    };
}

const CALENDAR_SOURCE = 'economic calendar: 3h cache';

/** The economy snapshot sits behind two stacked 24h caches, so it can be this many days old. */
const SNAPSHOT_MAX_STALE_DAYS = 2;

/**
 * Default-call fallback when the calendar read fails: the snapshot's own
 * calendar, run through the same selection. Its window is
 * `SNAPSHOT_CALENDAR_WINDOW_DAYS` from when it was built, so `coverage` claims
 * `SNAPSHOT_MAX_STALE_DAYS` less than that window.
 */
function snapshotCalendarBlock(
    snapshot: EconomySnapshot,
    today: string,
    now: number
): CalendarBlock {
    return {
        ...calendarBlock(
            snapshot.calendar,
            {
                from: today,
                to: addUtcIsoDays(
                    today,
                    SNAPSHOT_CALENDAR_WINDOW_DAYS - SNAPSHOT_MAX_STALE_DAYS
                ),
            },
            now,
            new Date(now)
        ),
        fallback: 'economy snapshot (calendar read failed)',
    };
}

const KR_INDICATOR_SOURCE =
    'Korean indicators: rebuilt from calendar release history (DB, day cache)';

/** Said next to the Korean indicators: their dates and the calendar's are on different clocks. */
const KR_DATE_NOTE =
    'indicators[].latest.date is the KST calendar date of the release; calendar event dates are UTC instants';

/**
 * Korean calendar fallback when the range read fails: the DB rows the hourly
 * ingestion keeps (`getCalendarFromDb`, today ± its 14-day window), through the
 * same selection. The window ends a day short at worst (ET anchor vs UTC
 * dates, `calendarWindow.ts`), so `coverage` claims one day less. `null` when
 * the DB has nothing either — an empty fallback would read as "nothing
 * scheduled" (SERVER.md#SA-18).
 */
async function koreanCalendarFromDb(
    today: string,
    now: number
): Promise<CalendarBlock | null> {
    const rows = await getCalendarFromDb(today, CALENDAR_COUNTRY_KR);
    if (rows.length === 0) return null;
    const events: EconomicCalendarEvent[] = rows.map(row => ({
        date: row.date,
        event: row.event,
        impact: row.impact,
        actual: row.actual,
        estimate: row.estimate,
        previous: row.previous,
        unit: row.unit,
    }));
    return {
        ...calendarBlock(
            events,
            { from: today, to: addUtcIsoDays(futureWindowEnd(today), -1) },
            now,
            new Date(now)
        ),
        fallback: 'ingested Korean calendar (calendar read failed)',
    };
}

/**
 * `country: 'kr'` default call: Korean indicator cards (`getKrIndicatorCards`,
 * rebuilt from calendar `actual` values — FMP has no Korean indicator series)
 * and the Korean calendar of the next {@link ECONOMY_CALENDAR_DEFAULT_DAYS}
 * days. There is no Korean treasury curve or macro briefing, so those fields
 * are absent rather than filled from US data.
 */
async function koreanEconomy(
    range: CalendarRange,
    now: number,
    label: CountryLabel
): Promise<Record<string, unknown>> {
    // `getKrIndicatorCards` logs and degrades a DB failure to `[]` itself.
    const [cards, read] = await Promise.all([
        getKrIndicatorCards(range.from),
        readCalendar(CALENDAR_COUNTRY_KR, range, now, new Date(now)),
    ]);
    const calendar = read ?? (await koreanCalendarFromDb(range.from, now));
    if (cards.length === 0 && calendar === null)
        return { available: false, reason: 'kr_economy_unavailable' };
    return {
        asOf: new Date(now).toISOString(),
        country: label,
        source: `${KR_INDICATOR_SOURCE}; ${CALENDAR_SOURCE}`,
        available: true,
        note: KR_DATE_NOTE,
        indicators: cards.map(card => {
            // `changeFromPrevious` is a raw subtraction of two releases — round
            // it like the US deltas so float noise never reaches the answer.
            const change =
                card.changeFromPrevious === null
                    ? null
                    : roundNumber(card.changeFromPrevious);
            return {
                name: card.meta.event,
                label: card.meta.label,
                unit: card.meta.unit,
                latest: { date: card.latestDate, value: card.latest },
                change,
                // Same meaning as the US field: a '%' series moves in
                // percentage points, anything else in its own unit.
                changeUnit: card.meta.unit === '%' ? 'pp' : 'level',
                direction: directionOf(change),
            };
        }),
        // `getKrIndicatorCards` turns a DB failure into `[]`, and the registry
        // always has releases in its window, so an empty list is a failed read
        // — mark it so the model does not report "no Korean rate data".
        ...(cards.length === 0 ? { indicatorsUnavailable: true } : {}),
        // `null` only when both the read and the ingested fallback failed —
        // the marker keeps that from reading as an empty calendar.
        ...(calendar === null
            ? { calendar: null, calendarUnavailable: true }
            : { calendar }),
    };
}

/**
 * Macro data for one economy (`country`: US default, or South Korea — see
 * `koreanEconomy`). US: indicators, treasury yields, the economic calendar of the
 * next {@link ECONOMY_CALENDAR_DEFAULT_DAYS} days (from now on, picked by core's
 * `selectCalendarEvents`), and the cached macro briefing headline when
 * available. With `from`/`to` it returns only that period's calendar, past
 * releases included — a narrower result for a follow-up lookup in the same turn.
 *
 * Ranged calls have no per-turn cap of their own, by choice: the product
 * decision is to give the agent as much calendar as a question needs, and
 * core's `AGENT_TURN_CAPS` (`maxSteps`, `maxToolCalls`) already bound how many
 * calls one turn makes. A repeated range is a Redis hit for 3h, so FMP sees
 * at most one read per distinct range per window.
 *
 * `peekMacroBriefingStatic` requires the snapshot as input, so it cannot run
 * concurrently with the snapshot fetch (no `Promise.allSettled` fan-out here
 * — the sections are sequentially dependent, not independent). Its own
 * failure still degrades gracefully via `.catch`.
 */
export const getEconomyTool: ToolExecutor = async args => {
    const now = Date.now();
    const today = etDateOf(new Date(now));
    const countryArg = parseCountryArg(args.country);
    const parsed = parseRangeArgs(args, today);
    const issues = [
        ...(countryArg.ok ? [] : [countryArg.issue]),
        ...(parsed.ok ? [] : parsed.issues),
    ];
    if (!countryArg.ok || !parsed.ok) return { error: 'invalid_args', issues };
    // Every result names its country, so a ranged retry that dropped
    // `country` shows up as a US calendar instead of passing for a Korean one.
    const { country, label: countryLabel } = countryArg;

    if (parsed.range !== null) {
        const calendar = await readCalendar(country, parsed.range, now);
        if (!calendar)
            return { available: false, reason: 'calendar_unavailable' };
        return {
            asOf: new Date(now).toISOString(),
            country: countryLabel,
            source: CALENDAR_SOURCE,
            available: true,
            calendar,
        };
    }

    const defaultRange = {
        from: today,
        to: addUtcIsoDays(today, ECONOMY_CALENDAR_DEFAULT_DAYS),
    };
    if (country === CALENDAR_COUNTRY_KR)
        return koreanEconomy(defaultRange, now, countryLabel);
    // `getFreshTreasuryRates` never rejects (degrades to `null`).
    const [snapshot, freshTreasury, calendar] = await Promise.all([
        getEconomySnapshotStatic().catch((error: unknown) => {
            logToolDegrade('get_economy', 'economy snapshot', error);
            return null;
        }),
        getFreshTreasuryRates(),
        readCalendar(CALENDAR_COUNTRY, defaultRange, now, new Date(now)),
    ]);
    // The calendar no longer comes from the snapshot, so a snapshot outage
    // still answers "when is the next FOMC?".
    if (!snapshot)
        return {
            available: false,
            reason: 'snapshot_unavailable',
            ...(calendar ? { calendar } : {}),
        };

    const briefing = await peekMacroBriefingStatic(
        snapshot,
        macroBriefingDayKey()
    )
        .then(entry => entry?.briefing ?? null)
        .catch((error: unknown) => {
            logToolDegrade('get_economy', 'macro briefing', error);
            return null;
        });

    return {
        asOf: new Date(now).toISOString(),
        country: countryLabel,
        source: `economy snapshot (indicators: day cache, up to ~48h); treasury: see treasury.cache; ${CALENDAR_SOURCE}`,
        available: true,
        indicators: snapshot.indicators.map(i => {
            const change = ppDelta(
                i.latest?.value ?? null,
                i.previous?.value ?? null
            );
            return {
                name: i.name,
                // Only ever `'%'` today (core's rate-type marker) or absent
                // (level-type) — see `changeUnit` below for what that means
                // for `change`.
                unit: i.unit ?? null,
                latest: i.latest,
                previous: i.previous,
                change,
                // `change` is always a raw `latest - previous` subtraction
                // (`ppDelta`) — for a rate-type series (`unit === '%'`) that
                // IS a percentage-point delta, but for a level series (CPI,
                // GDP, payrolls, …) it's a same-unit-as-the-value delta, NOT
                // a percentage. This disambiguates which one `change` is
                // without renaming the field.
                changeUnit: i.unit === '%' ? 'pp' : 'level',
                direction: directionOf(change),
            };
        }),
        treasury: treasuryView(pickTreasury(snapshot.treasury, freshTreasury)),
        calendar: calendar ?? snapshotCalendarBlock(snapshot, today, now),
        briefing: briefing && {
            summary: briefing.summary,
            regime: briefing.regime,
        },
    };
};
