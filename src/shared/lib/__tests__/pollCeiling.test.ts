import { hasExceededPollCeiling } from '../pollCeiling';
import { ANALYSIS_POLL_MAX_DURATION_MS } from '@/shared/config/pollingConfig';

describe('hasExceededPollCeiling', () => {
    const frozenStart = 1_700_000_000_000;

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns false while elapsed time is below the ceiling', () => {
        vi.spyOn(Date, 'now').mockReturnValue(
            frozenStart + ANALYSIS_POLL_MAX_DURATION_MS - 1
        );

        expect(hasExceededPollCeiling(frozenStart)).toBe(false);
    });

    it('returns true exactly at the ceiling (inclusive boundary, mirrors >=)', () => {
        vi.spyOn(Date, 'now').mockReturnValue(
            frozenStart + ANALYSIS_POLL_MAX_DURATION_MS
        );

        expect(hasExceededPollCeiling(frozenStart)).toBe(true);
    });

    it('returns true once elapsed time exceeds the ceiling', () => {
        vi.spyOn(Date, 'now').mockReturnValue(
            frozenStart + ANALYSIS_POLL_MAX_DURATION_MS + 1
        );

        expect(hasExceededPollCeiling(frozenStart)).toBe(true);
    });

    it('returns false immediately after the poll start (no elapsed time)', () => {
        vi.spyOn(Date, 'now').mockReturnValue(frozenStart);

        expect(hasExceededPollCeiling(frozenStart)).toBe(false);
    });
});
