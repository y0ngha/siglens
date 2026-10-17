import { describe, expect, it } from 'vitest';
import {
    initialFinraRebackfillValue,
    parseFinraRebackfillProgress,
    rebackfillDates,
    serializeFinraRebackfillProgress,
} from '../../lib/finraRebackfill';

describe('finraRebackfill', () => {
    it('round-trips the progress cursor', () => {
        const progress = {
            requestedAt: '2026-10-16T03:00:00.000Z',
            volumeBefore: '2026-09-01',
            interestBefore: null,
        };
        expect(
            parseFinraRebackfillProgress(
                serializeFinraRebackfillProgress(progress)
            )
        ).toEqual(progress);
    });

    it('starts with nothing re-read', () => {
        expect(
            parseFinraRebackfillProgress(
                initialFinraRebackfillValue(new Date('2026-10-16T03:00:00Z'))
            )
        ).toEqual({
            requestedAt: '2026-10-16T03:00:00.000Z',
            volumeBefore: null,
            interestBefore: null,
        });
    });

    it.each(['1', 'not json', 'null', '{"volumeBefore":"yesterday"}'])(
        'reads an unreadable value %s as "start from the newest" rather than dropping the request',
        value => {
            expect(parseFinraRebackfillProgress(value)).toMatchObject({
                volumeBefore: null,
                interestBefore: null,
            });
        }
    );

    it('lists stored dates older than the cursor, newest first', () => {
        const stored = new Set(['2026-09-30', '2026-10-15', '2026-09-15']);
        expect(rebackfillDates(stored, null)).toEqual([
            '2026-10-15',
            '2026-09-30',
            '2026-09-15',
        ]);
        expect(rebackfillDates(stored, '2026-09-30')).toEqual(['2026-09-15']);
    });
});
