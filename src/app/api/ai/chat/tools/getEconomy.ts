import 'server-only';
import {
    type CalendarImpact,
    computeYieldSpread,
    type EconomicCalendarEvent,
    type TreasuryRateSnapshot,
} from '@y0ngha/siglens-core';
import { getEconomySnapshotStatic } from '@/entities/economy/api/economySnapshotStaticCache';
import {
    type FreshTreasuryRates,
    getFreshTreasuryRates,
    TREASURY_CACHE_TTL_SECONDS,
    TREASURY_FALLBACK_TTL_SECONDS,
} from '@/entities/economy/api/treasuryRatesCache';
import { peekMacroBriefingStatic } from '@/entities/economy/api/macroBriefingStaticCache';
import { macroBriefingDayKey } from '@/entities/economy/lib/macroBriefingDayKey';
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
 * Upcoming-calendar cap. Picked by impact first (`IMPACT_PRIORITY`), so it
 * holds every High event of the snapshot's 60-day window (61 measured on
 * 2026-10-23) with Medium filling the rest. A cap below the High count would
 * drop the farthest Highs — the next FOMC decision among them. Size:
 * `ECONOMY_RESULT_MAX_CHARS` (`truncate.ts`).
 */
const CALENDAR_MAX_EVENTS = 80;

/**
 * Selection order for the cap. Until 2026-10 the tool took the first 10 events
 * by date, and on an ordinary week Low-impact rows (rig count, CFTC positions)
 * filled every slot — an FOMC decision 5 days out never reached the model.
 */
const IMPACT_PRIORITY: Record<CalendarImpact, number> = {
    High: 0,
    Medium: 1,
    Low: 2,
};

const timeOf = (e: EconomicCalendarEvent): number => new Date(e.date).getTime();

/**
 * Future events, at most `CALENDAR_MAX_EVENTS`: High first, then Medium, then
 * Low, each nearest-first; the pick is returned date-ascending. Expects ISO
 * dates (`fmpCalendarDateTimeToIso` already applied).
 */
function pickUpcomingEvents(
    events: readonly EconomicCalendarEvent[],
    now: number
): EconomicCalendarEvent[] {
    return events
        .filter(e => timeOf(e) >= now)
        .toSorted(
            (a, b) =>
                IMPACT_PRIORITY[a.impact] - IMPACT_PRIORITY[b.impact] ||
                timeOf(a) - timeOf(b)
        )
        .slice(0, CALENDAR_MAX_EVENTS)
        .toSorted((a, b) => timeOf(a) - timeOf(b));
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

/**
 * US macro snapshot: indicators, treasury yields, upcoming calendar (the
 * whole remaining 60-day snapshot window, picked by impact — see
 * `pickUpcomingEvents`), and the cached macro briefing headline when available.
 *
 * `peekMacroBriefingStatic` requires the snapshot as input, so it cannot run
 * concurrently with the snapshot fetch (no `Promise.allSettled` fan-out here
 * — the sections are sequentially dependent, not independent). Its own
 * failure still degrades gracefully via `.catch`.
 *
 * Calendar dates go through `fmpCalendarDateTimeToIso` (FMP sends UTC with no
 * zone marker; see its JSDoc) so core can localize them to the user's zone.
 */
export const getEconomyTool: ToolExecutor = async () => {
    // `getFreshTreasuryRates` never rejects (degrades to `null`).
    const [snapshot, freshTreasury] = await Promise.all([
        getEconomySnapshotStatic().catch((error: unknown) => {
            logToolDegrade('get_economy', 'economy snapshot', error);
            return null;
        }),
        getFreshTreasuryRates(),
    ]);
    if (!snapshot) return { available: false, reason: 'snapshot_unavailable' };

    const briefing = await peekMacroBriefingStatic(
        snapshot,
        macroBriefingDayKey()
    )
        .then(entry => entry?.briefing ?? null)
        .catch((error: unknown) => {
            logToolDegrade('get_economy', 'macro briefing', error);
            return null;
        });

    const now = Date.now();
    const upcomingCalendar = pickUpcomingEvents(
        snapshot.calendar.map(e => ({
            ...e,
            date: fmpCalendarDateTimeToIso(e.date),
        })),
        now
    ).map(e => ({
        ...e,
        hoursUntil: Math.round((timeOf(e) - now) / MS_PER_HOUR),
    }));

    return {
        asOf: new Date().toISOString(),
        source: 'economy snapshot (indicators/calendar: day cache, up to ~48h); treasury: see treasury.cache',
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
        upcomingCalendar,
        briefing: briefing && {
            summary: briefing.summary,
            regime: briefing.regime,
        },
    };
};
