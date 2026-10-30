import { isoDateParts } from '@/widgets/market-fear-greed/utils/isoDateParts';

describe('isoDateParts', () => {
    it('splits an ISO calendar date into numeric year, month and day', () => {
        expect(isoDateParts('2026-08-14')).toEqual({
            year: 2026,
            month: 8,
            day: 14,
        });
    });

    it('drops leading zeros from single-digit months and days', () => {
        expect(isoDateParts('2025-01-05')).toEqual({
            year: 2025,
            month: 1,
            day: 5,
        });
    });

    it('keeps the written date on a UTC-midnight boundary instead of shifting it', () => {
        expect(isoDateParts('2026-12-31')).toEqual({
            year: 2026,
            month: 12,
            day: 31,
        });
    });
});
