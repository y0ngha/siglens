import { describe, expect, it } from 'vitest';
import {
    isNextEarningsCacheFresh,
    nextEarningsTtlSeconds,
} from '@/shared/api/fmp/nextEarningsCachePolicy';
import {
    SECONDS_PER_HOUR,
    SECONDS_PER_QUARTER_DAY,
} from '@/shared/config/time';

const TODAY = '2026-10-11';
const report = (earningsDate: string) => ({ symbol: 'AAPL', earningsDate });

describe('isNextEarningsCacheFresh', () => {
    it('오늘 이후의 실적일은 그대로 쓴다', () => {
        expect(isNextEarningsCacheFresh(report('2026-10-30'), TODAY)).toBe(
            true
        );
    });

    it('오늘이 실적일이면 그대로 쓴다', () => {
        expect(isNextEarningsCacheFresh(report(TODAY), TODAY)).toBe(true);
    });

    it('이미 지난 실적일은 쓰지 않고 다시 받는다', () => {
        expect(isNextEarningsCacheFresh(report('2026-10-10'), TODAY)).toBe(
            false
        );
    });

    it('일정이 없는 값(null)은 TTL 동안 쓴다', () => {
        expect(isNextEarningsCacheFresh(null, TODAY)).toBe(true);
    });

    it('시각이 붙은 실적일도 날짜로 비교한다', () => {
        expect(
            isNextEarningsCacheFresh(report('2026-10-10T20:00:00Z'), TODAY)
        ).toBe(false);
    });
});

describe('nextEarningsTtlSeconds', () => {
    it('실적일이 이틀 이상 남았으면 6시간 둔다', () => {
        expect(nextEarningsTtlSeconds(report('2026-10-13'), TODAY)).toBe(
            SECONDS_PER_QUARTER_DAY
        );
    });

    it('실적일이 내일이면 1시간만 둔다', () => {
        expect(nextEarningsTtlSeconds(report('2026-10-12'), TODAY)).toBe(
            SECONDS_PER_HOUR
        );
    });

    it('실적일이 오늘이면 1시간만 둔다', () => {
        expect(nextEarningsTtlSeconds(report(TODAY), TODAY)).toBe(
            SECONDS_PER_HOUR
        );
    });

    it('받은 값이 지난 실적일이어도 1시간을 넘기지 않는다', () => {
        expect(nextEarningsTtlSeconds(report('2026-08-01'), TODAY)).toBe(
            SECONDS_PER_HOUR
        );
    });

    it('일정이 없으면(null) 1시간 둔다', () => {
        expect(nextEarningsTtlSeconds(null, TODAY)).toBe(SECONDS_PER_HOUR);
    });
});
