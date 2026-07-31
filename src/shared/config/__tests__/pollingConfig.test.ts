import {
    ANALYSIS_POLL_INTERVAL_MS,
    ANALYSIS_POLL_MAX_DURATION_MS,
    ANALYSIS_POLL_TIMEOUT_MESSAGE,
    AUGMENT_AND_OVERALL_POLL_INTERVAL_MS,
    CHART_ANALYSIS_POLL_INTERVAL_MS,
} from '@/shared/config/pollingConfig';
import { MS_PER_MINUTE } from '@/shared/config/time';

describe('ANALYSIS_POLL_INTERVAL_MS', () => {
    it('양의 정수이다', () => {
        expect(typeof ANALYSIS_POLL_INTERVAL_MS).toBe('number');
        expect(Number.isInteger(ANALYSIS_POLL_INTERVAL_MS)).toBe(true);
        expect(ANALYSIS_POLL_INTERVAL_MS).toBeGreaterThan(0);
    });

    it('10000ms로 설정되어 있다', () => {
        expect(ANALYSIS_POLL_INTERVAL_MS).toBe(10_000);
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

    it('5000ms로 설정되어 있다', () => {
        expect(AUGMENT_AND_OVERALL_POLL_INTERVAL_MS).toBe(5000);
    });
});

describe('CHART_ANALYSIS_POLL_INTERVAL_MS', () => {
    it('양의 정수이다', () => {
        expect(typeof CHART_ANALYSIS_POLL_INTERVAL_MS).toBe('number');
        expect(Number.isInteger(CHART_ANALYSIS_POLL_INTERVAL_MS)).toBe(true);
        expect(CHART_ANALYSIS_POLL_INTERVAL_MS).toBeGreaterThan(0);
    });

    it('30000ms로 설정되어 있다', () => {
        expect(CHART_ANALYSIS_POLL_INTERVAL_MS).toBe(30_000);
    });
});

describe('ANALYSIS_POLL_MAX_DURATION_MS', () => {
    it('양의 정수이다', () => {
        expect(typeof ANALYSIS_POLL_MAX_DURATION_MS).toBe('number');
        expect(Number.isInteger(ANALYSIS_POLL_MAX_DURATION_MS)).toBe(true);
        expect(ANALYSIS_POLL_MAX_DURATION_MS).toBeGreaterThan(0);
    });

    it('5분(300000ms)으로 설정되어 있다', () => {
        // 소스(pollingConfig.ts)가 `5 * MS_PER_MINUTE`로 정의하므로, 테스트도
        // 같은 상수를 import해 단일 source of truth를 공유한다 — 리터럴을
        // 로컬에서 재도출하면 MS_PER_MINUTE 자체가 바뀌었을 때 두 값이
        // 우연히도 여전히 같아 보이는 착시가 생길 수 있다. REQUIRED 7.
        expect(ANALYSIS_POLL_MAX_DURATION_MS).toBe(5 * MS_PER_MINUTE);
    });
});

describe('ANALYSIS_POLL_TIMEOUT_MESSAGE', () => {
    it('비어 있지 않은 문자열이다', () => {
        expect(typeof ANALYSIS_POLL_TIMEOUT_MESSAGE).toBe('string');
        expect(ANALYSIS_POLL_TIMEOUT_MESSAGE.length).toBeGreaterThan(0);
    });
});

describe('폴링 간격 순서', () => {
    // 작업 응답 시간 비례: overall(캐시 적중률 높아 빨리 끝남) < 단일 LLM 분석 < 차트 다단계 워커.
    it('AUGMENT_AND_OVERALL < ANALYSIS < CHART_ANALYSIS 순서로 커진다', () => {
        expect(AUGMENT_AND_OVERALL_POLL_INTERVAL_MS).toBeLessThan(
            ANALYSIS_POLL_INTERVAL_MS
        );
        expect(ANALYSIS_POLL_INTERVAL_MS).toBeLessThan(
            CHART_ANALYSIS_POLL_INTERVAL_MS
        );
    });
});
