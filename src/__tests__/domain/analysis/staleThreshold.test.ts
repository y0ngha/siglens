import { isAnalysisStale, getStaleThresholdMs } from '@/domain/analysis/staleThreshold';
import type { Timeframe } from '@y0ngha/siglens-core';

describe('getStaleThresholdMs', () => {
    it.each<[Timeframe, number]>([
        ['5Min', 5 * 60 * 1000],
        ['15Min', 5 * 60 * 1000],
        ['30Min', 5 * 60 * 1000],
        ['1Hour', 30 * 60 * 1000],
        ['4Hour', 30 * 60 * 1000],
        ['1Day', 4 * 60 * 60 * 1000],
    ])('returns the expected threshold for %s', (timeframe, expected) => {
        expect(getStaleThresholdMs(timeframe)).toBe(expected);
    });
});

describe('isAnalysisStale', () => {
    const now = new Date('2026-05-22T12:00:00.000Z');

    it('returns false when analyzed within threshold (1Day, 3h ago)', () => {
        const analyzedAt = new Date('2026-05-22T09:00:00.000Z').toISOString();
        expect(isAnalysisStale(analyzedAt, '1Day', now)).toBe(false);
    });

    it('returns true when analyzed beyond threshold (1Day, 5h ago)', () => {
        const analyzedAt = new Date('2026-05-22T07:00:00.000Z').toISOString();
        expect(isAnalysisStale(analyzedAt, '1Day', now)).toBe(true);
    });

    it('returns true when analyzed beyond threshold (5Min, 10min ago)', () => {
        const analyzedAt = new Date('2026-05-22T11:50:00.000Z').toISOString();
        expect(isAnalysisStale(analyzedAt, '5Min', now)).toBe(true);
    });

    it('returns false for invalid ISO input', () => {
        expect(isAnalysisStale('not-a-date', '1Day', now)).toBe(false);
    });
});
