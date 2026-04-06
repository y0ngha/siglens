import type { Timeframe } from '@/domain/types';
import {
    DEFAULT_BARS_LIMIT,
    DEFAULT_TIMEFRAME,
    TIMEFRAME_BARS_LIMIT,
    TIMEFRAME_LOOKBACK_DAYS,
} from '@/domain/constants/market';

describe('DEFAULT_TIMEFRAME', () => {
    describe('기본값 확인', () => {
        it("'1Day'를 반환한다", () => {
            expect(DEFAULT_TIMEFRAME).toBe('1Day');
        });
    });
});

describe('DEFAULT_BARS_LIMIT', () => {
    describe('기본값 확인', () => {
        it('TIMEFRAME_BARS_LIMIT[DEFAULT_TIMEFRAME]과 동일한 값을 반환한다', () => {
            expect(DEFAULT_BARS_LIMIT).toBe(
                TIMEFRAME_BARS_LIMIT[DEFAULT_TIMEFRAME]
            );
        });
    });
});

describe('TIMEFRAME_BARS_LIMIT', () => {
    const ALL_TIMEFRAMES: Timeframe[] = [
        '1Min',
        '5Min',
        '15Min',
        '1Hour',
        '1Day',
    ];

    describe('모든 Timeframe 값에 대한 항목이 존재할 때', () => {
        it.each(ALL_TIMEFRAMES)("'%s'는 양의 정수 limit을 가진다", tf => {
            const limit = TIMEFRAME_BARS_LIMIT[tf];
            expect(typeof limit).toBe('number');
            expect(Number.isInteger(limit)).toBe(true);
            expect(limit).toBeGreaterThan(0);
        });

        it('모든 Timeframe 키를 커버한다', () => {
            const keys = Object.keys(TIMEFRAME_BARS_LIMIT) as Timeframe[];
            expect(keys.sort()).toEqual([...ALL_TIMEFRAMES].sort());
        });
    });

    describe('각 타임프레임별 limit 값', () => {
        it("'1Min'에 대해 200을 반환한다", () => {
            expect(TIMEFRAME_BARS_LIMIT['1Min']).toBe(200);
        });

        it("'5Min'에 대해 288을 반환한다", () => {
            expect(TIMEFRAME_BARS_LIMIT['5Min']).toBe(288);
        });

        it("'15Min'에 대해 200을 반환한다", () => {
            expect(TIMEFRAME_BARS_LIMIT['15Min']).toBe(200);
        });

        it("'1Hour'에 대해 200을 반환한다", () => {
            expect(TIMEFRAME_BARS_LIMIT['1Hour']).toBe(200);
        });

        it("'1Day'에 대해 500을 반환한다", () => {
            expect(TIMEFRAME_BARS_LIMIT['1Day']).toBe(500);
        });
    });
});

describe('TIMEFRAME_LOOKBACK_DAYS', () => {
    const ALL_TIMEFRAMES: Timeframe[] = [
        '1Min',
        '5Min',
        '15Min',
        '1Hour',
        '1Day',
    ];

    describe('모든 Timeframe 값에 대한 항목이 존재할 때', () => {
        it.each(ALL_TIMEFRAMES)(
            "'%s'는 양의 정수 lookback days를 가진다",
            tf => {
                const days = TIMEFRAME_LOOKBACK_DAYS[tf];
                expect(typeof days).toBe('number');
                expect(Number.isInteger(days)).toBe(true);
                expect(days).toBeGreaterThan(0);
            }
        );

        it('모든 Timeframe 키를 커버한다', () => {
            const keys = Object.keys(TIMEFRAME_LOOKBACK_DAYS) as Timeframe[];
            expect(keys.sort()).toEqual([...ALL_TIMEFRAMES].sort());
        });
    });

    describe('각 타임프레임별 lookback days 값', () => {
        it("'1Min'에 대해 5를 반환한다", () => {
            expect(TIMEFRAME_LOOKBACK_DAYS['1Min']).toBe(5);
        });

        it("'5Min'에 대해 10을 반환한다", () => {
            expect(TIMEFRAME_LOOKBACK_DAYS['5Min']).toBe(10);
        });

        it("'15Min'에 대해 20을 반환한다", () => {
            expect(TIMEFRAME_LOOKBACK_DAYS['15Min']).toBe(20);
        });

        it("'1Hour'에 대해 60을 반환한다", () => {
            expect(TIMEFRAME_LOOKBACK_DAYS['1Hour']).toBe(60);
        });

        it("'1Day'에 대해 730을 반환한다", () => {
            expect(TIMEFRAME_LOOKBACK_DAYS['1Day']).toBe(730);
        });
    });
});
