import type { Timeframe } from '@y0ngha/siglens-core';
import {
    DEFAULT_TIMEFRAME,
    isValidTimeframe,
    TIMEFRAMES,
} from '@/shared/config/market';

describe('DEFAULT_TIMEFRAME', () => {
    describe('기본값 확인', () => {
        it("'1Day'를 반환한다", () => {
            expect(DEFAULT_TIMEFRAME).toBe('1Day');
        });
    });
});

describe('TIMEFRAMES', () => {
    const ALL_TIMEFRAME_VALUES: Timeframe[] = [
        '5Min',
        '15Min',
        '30Min',
        '1Hour',
        '4Hour',
        '1Day',
    ];

    it('Timeframe 유니언의 모든 값을 포함한다', () => {
        expect([...TIMEFRAMES].sort()).toEqual(
            [...ALL_TIMEFRAME_VALUES].sort()
        );
    });
});

describe('isValidTimeframe', () => {
    describe('유효한 Timeframe 문자열일 때', () => {
        it("'1Day'에 대해 true를 반환한다", () => {
            expect(isValidTimeframe('1Day')).toBe(true);
        });

        it("'5Min'에 대해 true를 반환한다", () => {
            expect(isValidTimeframe('5Min')).toBe(true);
        });

        it("'30Min'에 대해 true를 반환한다", () => {
            expect(isValidTimeframe('30Min')).toBe(true);
        });

        it("'4Hour'에 대해 true를 반환한다", () => {
            expect(isValidTimeframe('4Hour')).toBe(true);
        });
    });

    describe('유효하지 않은 값일 때', () => {
        it('알 수 없는 문자열에 대해 false를 반환한다', () => {
            expect(isValidTimeframe('invalid')).toBe(false);
        });

        it('undefined에 대해 false를 반환한다', () => {
            expect(isValidTimeframe(undefined)).toBe(false);
        });

        it('null에 대해 false를 반환한다', () => {
            expect(isValidTimeframe(null)).toBe(false);
        });
    });
});
