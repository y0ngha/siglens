import { isAnalysisStale } from '@/domain/analysis/staleThreshold';
import { MS_PER_HOUR } from '@/domain/constants/time';

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

    it('returns false at the exact boundary (1Day, 4h ago — strict >)', () => {
        const analyzedAt = new Date(now.getTime() - 4 * MS_PER_HOUR).toISOString();
        expect(isAnalysisStale(analyzedAt, '1Day', now)).toBe(false);
    });

    it('returns true when analyzed beyond threshold (5Min, 10min ago)', () => {
        const analyzedAt = new Date('2026-05-22T11:50:00.000Z').toISOString();
        expect(isAnalysisStale(analyzedAt, '5Min', now)).toBe(true);
    });

    it('returns false for invalid ISO input', () => {
        expect(isAnalysisStale('not-a-date', '1Day', now)).toBe(false);
    });
});
