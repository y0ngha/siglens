import 'server-only';
import { getEconomySnapshotStatic } from '@/entities/economy/api/economySnapshotStaticCache';
import { peekMacroBriefingStatic } from '@/entities/economy/api/macroBriefingStaticCache';
import { ISO_DATE_HOUR_SLICE_END, MS_PER_DAY } from '@/shared/config/time';
import type { ToolExecutor } from './index';

const CALENDAR_WINDOW_DAYS = 7;
/** Defensive cap — bounds the payload even if an unusually event-dense week slips past the 7-day filter. */
const CALENDAR_MAX_EVENTS = 10;

/**
 * US macro snapshot: indicators, treasury yields, upcoming calendar (next 7
 * days out of the cached snapshot's 14-day window), and the cached macro
 * briefing headline when available.
 *
 * `peekMacroBriefingStatic` requires the snapshot as input, so it cannot run
 * concurrently with the snapshot fetch (no `Promise.allSettled` fan-out here
 * — the sections are sequentially dependent, not independent). Its own
 * failure still degrades gracefully via `.catch`.
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
        .filter(e => {
            const t = new Date(e.date).getTime();
            return t >= now && t <= windowEnd;
        })
        .slice(0, CALENDAR_MAX_EVENTS);

    return {
        asOf: new Date().toISOString(),
        source: 'economy snapshot (24h cache)',
        available: true,
        indicators: snapshot.indicators.map(i => ({
            name: i.name,
            latest: i.latest,
            previous: i.previous,
        })),
        treasury: snapshot.treasury,
        upcomingCalendar,
        briefing: briefing && {
            summary: briefing.summary,
            regime: briefing.regime,
        },
    };
};
