import {
    ANALYSIS_POLL_INTERVAL_MS,
    AUGMENT_AND_OVERALL_POLL_INTERVAL_MS,
    CHART_ANALYSIS_POLL_INTERVAL_MS,
} from '@/shared/config/pollingConfig';

describe('ANALYSIS_POLL_INTERVAL_MS', () => {
    it('양의 정수이다', () => {
        expect(typeof ANALYSIS_POLL_INTERVAL_MS).toBe('number');
        expect(Number.isInteger(ANALYSIS_POLL_INTERVAL_MS)).toBe(true);
        expect(ANALYSIS_POLL_INTERVAL_MS).toBeGreaterThan(0);
    });

    it('2500ms로 설정되어 있다', () => {
        expect(ANALYSIS_POLL_INTERVAL_MS).toBe(2500);
    });
});

describe('AUGMENT_AND_OVERALL_POLL_INTERVAL_MS', () => {
    it('양의 정수이다', () => {
        expect(typeof AUGMENT_AND_OVERALL_POLL_INTERVAL_MS).toBe('number');
        expect(Number.isInteger(AUGMENT_AND_OVERALL_POLL_INTERVAL_MS)).toBe(
            true
        );
        expect(AUGMENT_AND_OVERALL_POLL_INTERVAL_MS).toBeGreaterThan(0);
    });

    it('3000ms로 설정되어 있다', () => {
        expect(AUGMENT_AND_OVERALL_POLL_INTERVAL_MS).toBe(3000);
    });
});

describe('CHART_ANALYSIS_POLL_INTERVAL_MS', () => {
    it('양의 정수이다', () => {
        expect(typeof CHART_ANALYSIS_POLL_INTERVAL_MS).toBe('number');
        expect(Number.isInteger(CHART_ANALYSIS_POLL_INTERVAL_MS)).toBe(true);
        expect(CHART_ANALYSIS_POLL_INTERVAL_MS).toBeGreaterThan(0);
    });

    it('10000ms로 설정되어 있다', () => {
        expect(CHART_ANALYSIS_POLL_INTERVAL_MS).toBe(10_000);
    });
});

describe('폴링 간격 순서', () => {
    it('ANALYSIS < AUGMENT_AND_OVERALL < CHART_ANALYSIS 순서로 커진다', () => {
        expect(ANALYSIS_POLL_INTERVAL_MS).toBeLessThan(
            AUGMENT_AND_OVERALL_POLL_INTERVAL_MS
        );
        expect(AUGMENT_AND_OVERALL_POLL_INTERVAL_MS).toBeLessThan(
            CHART_ANALYSIS_POLL_INTERVAL_MS
        );
    });
});
