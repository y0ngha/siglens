import 'server-only';
import {
    computeYieldSpread,
    type TreasuryRateSnapshot,
} from '@y0ngha/siglens-core';
import { getEconomySnapshotStatic } from '@/entities/economy/api/economySnapshotStaticCache';
import { peekMacroBriefingStatic } from '@/entities/economy/api/macroBriefingStaticCache';
import {
    ISO_DATE_HOUR_SLICE_END,
    MS_PER_DAY,
    MS_PER_HOUR,
} from '@/shared/config/time';
import { fmpCalendarDateTimeToIso } from '@/shared/lib/etTimeUtils';
import type { ToolExecutor } from './index';
import { roundNumber } from '@/entities/bars/lib/roundIndicators';
import { ppDelta } from './percent';

const CALENDAR_WINDOW_DAYS = 7;
/** Defensive cap — bounds the payload even if an unusually event-dense week slips past the 7-day filter. */
const CALENDAR_MAX_EVENTS = 10;

/** `'up' | 'down' | 'unchanged'`, or `null` when `change` itself is `null` (spec §0 null rule). */
function directionOf(
    change: number | null
): 'up' | 'down' | 'unchanged' | null {
    if (change === null) return null;
    if (change > 0) return 'up';
    if (change < 0) return 'down';
    return 'unchanged';
}

/** `treasury` + the 2s10s spread/inversion flag (spec §3.6, audit B8) — `computeYieldSpread` is core's own rule, reused rather than reimplemented. */
function treasuryView(treasury: TreasuryRateSnapshot | null) {
    if (!treasury) return null;
    const rawSpread = computeYieldSpread(treasury);
    // `10y − 2y` in binary floats reads 0.39999999999999947; round like every
    // other number the agent quotes.
    const spread2s10s = rawSpread === null ? null : roundNumber(rawSpread);
    return {
        ...treasury,
        spread2s10s,
        curveInverted: spread2s10s === null ? null : spread2s10s < 0,
    };
}

/**
 * US macro snapshot: indicators, treasury yields, upcoming calendar (next 7
 * days out of the cached snapshot's 14-day window), and the cached macro
 * briefing headline when available.
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
    const snapshot = await getEconomySnapshotStatic().catch(() => null);
    if (!snapshot) return { available: false, reason: 'snapshot_unavailable' };

    const dateHour = new Date().toISOString().slice(0, ISO_DATE_HOUR_SLICE_END);
    const briefing = await peekMacroBriefingStatic(snapshot, dateHour).catch(
        () => null
    );

    const now = Date.now();
    const windowEnd = now + CALENDAR_WINDOW_DAYS * MS_PER_DAY;
    const upcomingCalendar = snapshot.calendar
        .map(e => ({ ...e, date: fmpCalendarDateTimeToIso(e.date) }))
        .filter(e => {
            const t = new Date(e.date).getTime();
            return t >= now && t <= windowEnd;
        })
        .slice(0, CALENDAR_MAX_EVENTS)
        .map(e => ({
            ...e,
            hoursUntil: Math.round(
                (new Date(e.date).getTime() - now) / MS_PER_HOUR
            ),
        }));

    return {
        asOf: new Date().toISOString(),
        source: 'economy snapshot (24h cache)',
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
        treasury: treasuryView(snapshot.treasury),
        upcomingCalendar,
        briefing: briefing && {
            summary: briefing.summary,
            regime: briefing.regime,
        },
    };
};
