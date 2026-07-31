import { hasExceededPollCeiling } from '../pollCeiling';
import { ANALYSIS_POLL_MAX_DURATION_MS } from '@/shared/config/pollingConfig';

describe('hasExceededPollCeiling', () => {
    it('returns false while elapsed time is below the ceiling', () => {
        expect(hasExceededPollCeiling(ANALYSIS_POLL_MAX_DURATION_MS - 1)).toBe(
            false
        );
    });

    it('returns true exactly at the ceiling (inclusive boundary, mirrors >=)', () => {
        expect(hasExceededPollCeiling(ANALYSIS_POLL_MAX_DURATION_MS)).toBe(
            true
        );
    });

    it('returns true once elapsed time exceeds the ceiling', () => {
        expect(hasExceededPollCeiling(ANALYSIS_POLL_MAX_DURATION_MS + 1)).toBe(
            true
        );
    });

    it('returns false immediately after the poll start (no elapsed time)', () => {
        expect(hasExceededPollCeiling(0)).toBe(false);
    });
});
