import {
    isAnalysisStale,
    STALE_THRESHOLD_MS,
} from '@/entities/analysis/lib/staleThreshold';
import { MS_PER_MINUTE } from '@/shared/config/time';

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

    it('returns false at the exact boundary (1Day — strict >)', () => {
        const analyzedAt = new Date(
            now.getTime() - STALE_THRESHOLD_MS['1Day']
        ).toISOString();
        expect(isAnalysisStale(analyzedAt, '1Day', now)).toBe(false);
    });

    it('returns false when analyzed within threshold (1Hour, 29min ago)', () => {
        const analyzedAt = new Date(
            now.getTime() - STALE_THRESHOLD_MS['1Hour'] + MS_PER_MINUTE
        ).toISOString();
        expect(isAnalysisStale(analyzedAt, '1Hour', now)).toBe(false);
    });

    it('returns true when analyzed beyond threshold (4Hour, boundary + 1min)', () => {
        const analyzedAt = new Date(
            now.getTime() - STALE_THRESHOLD_MS['4Hour'] - MS_PER_MINUTE
        ).toISOString();
        expect(isAnalysisStale(analyzedAt, '4Hour', now)).toBe(true);
    });

    it('returns true when analyzed beyond threshold (5Min, 10min ago)', () => {
        const analyzedAt = new Date('2026-05-22T11:50:00.000Z').toISOString();
        expect(isAnalysisStale(analyzedAt, '5Min', now)).toBe(true);
    });

    it('returns true when analyzed beyond threshold (15Min, boundary + 1min)', () => {
        const analyzedAt = new Date(
            now.getTime() - STALE_THRESHOLD_MS['15Min'] - MS_PER_MINUTE
        ).toISOString();
        expect(isAnalysisStale(analyzedAt, '15Min', now)).toBe(true);
    });

    it('returns false when analyzed within threshold (30Min, boundary - 1min)', () => {
        const analyzedAt = new Date(
            now.getTime() - STALE_THRESHOLD_MS['30Min'] + MS_PER_MINUTE
        ).toISOString();
        expect(isAnalysisStale(analyzedAt, '30Min', now)).toBe(false);
    });

    it('returns false for invalid ISO input', () => {
        expect(isAnalysisStale('not-a-date', '1Day', now)).toBe(false);
    });
});
