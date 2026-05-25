import { getTodayIsoDay } from '../getTodayIsoDay';

describe('getTodayIsoDay', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns UTC day quantized to midnight (00:00:00.000Z)', () => {
        vi.setSystemTime(new Date('2026-05-23T14:37:42.123Z'));
        expect(getTodayIsoDay()).toBe('2026-05-23T00:00:00.000Z');
    });

    it('preserves the date when system time is already at midnight UTC', () => {
        vi.setSystemTime(new Date('2026-05-23T00:00:00.000Z'));
        expect(getTodayIsoDay()).toBe('2026-05-23T00:00:00.000Z');
    });

    it('still emits the same day immediately before UTC day rollover', () => {
        vi.setSystemTime(new Date('2026-05-23T23:59:59.999Z'));
        expect(getTodayIsoDay()).toBe('2026-05-23T00:00:00.000Z');
    });

    it('emits the new UTC day immediately after rollover', () => {
        vi.setSystemTime(new Date('2026-05-24T00:00:00.000Z'));
        expect(getTodayIsoDay()).toBe('2026-05-24T00:00:00.000Z');
    });

    it('output always conforms to YYYY-MM-DDT00:00:00.000Z format', () => {
        vi.setSystemTime(new Date('2027-12-31T18:00:00.000Z'));
        expect(getTodayIsoDay()).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);
    });
});
