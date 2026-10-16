import { describe, expect, it } from 'vitest';
import {
    EMPTY_REG_SHO_CURSOR,
    parseRegShoCursor,
    serializeRegShoCursor,
} from '../../lib/regShoCursor';

describe('regShoCursor', () => {
    it('round-trips through the stored string', () => {
        const cursor = {
            lastByMarket: { nasdaq: '2026-10-15', cboe_bzx: '2026-10-14' },
            ingestedDates: ['2026-10-14', '2026-10-15'],
        };
        expect(
            parseRegShoCursor(serializeRegShoCursor(cursor, '2026-01-01'))
        ).toEqual(cursor);
    });

    it('drops ingested dates older than the retention floor and de-duplicates them in order', () => {
        const stored = serializeRegShoCursor(
            {
                lastByMarket: {},
                ingestedDates: [
                    '2026-10-15',
                    '2026-04-01',
                    '2026-10-14',
                    '2026-10-15',
                ],
            },
            '2026-04-19'
        );
        expect(parseRegShoCursor(stored).ingestedDates).toEqual([
            '2026-10-14',
            '2026-10-15',
        ]);
    });

    it.each([
        null,
        'not json',
        '42',
        '{"lastByMarket":"x","ingestedDates":"y"}',
    ])('reads %j as an empty cursor (backfill from scratch)', raw => {
        expect(parseRegShoCursor(raw)).toEqual(EMPTY_REG_SHO_CURSOR);
    });

    it('ignores malformed entries but keeps the valid ones', () => {
        expect(
            parseRegShoCursor(
                '{"lastByMarket":{"nasdaq":"2026-10-15","nyse":7},"ingestedDates":["2026-10-15","x"]}'
            )
        ).toEqual({
            lastByMarket: { nasdaq: '2026-10-15' },
            ingestedDates: ['2026-10-15'],
        });
    });
});
