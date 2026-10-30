import { describe, expect, it } from 'vitest';
import {
    ECONOMY_CALENDAR_DEFAULT_DAYS,
    ECONOMY_CALENDAR_MAX_RANGE_DAYS,
} from '@/shared/config/economyCalendar';
import { LOCALES } from '@/shared/i18n/locales';
import en from '../../../../../messages/en.json';
import ja from '../../../../../messages/ja.json';
import ko from '../../../../../messages/ko.json';
import zh from '../../../../../messages/zh.json';
import { DAYS_PER_WEEK, TOOL_SUMMARIES } from '../developersContent';

const catalogs = { ko, en, ja, zh } as const;

describe('TOOL_SUMMARIES', () => {
    it.each(LOCALES)(
        '%s: names exactly the tools the catalog has a summary for',
        locale => {
            expect(Object.keys(TOOL_SUMMARIES).toSorted()).toEqual(
                Object.keys(
                    catalogs[locale].views.developers.tools.summaries
                ).toSorted()
            );
        }
    );

    it('points each tool at its own summary key', () => {
        for (const [name, message] of Object.entries(TOOL_SUMMARIES))
            expect(message.key).toBe(`tools.summaries.${name}`);
    });

    it('fills the get_economy numbers from the calendar constants', () => {
        expect(TOOL_SUMMARIES.get_economy?.values).toEqual({
            weeks: ECONOMY_CALENDAR_DEFAULT_DAYS / DAYS_PER_WEEK,
            maxDays: ECONOMY_CALENDAR_MAX_RANGE_DAYS,
        });
    });
});
