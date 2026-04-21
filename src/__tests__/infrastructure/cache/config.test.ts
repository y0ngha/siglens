import {
    ANALYSIS_CACHE_TTL,
    buildAnalysisCacheKey,
    buildBriefingCacheKey,
    buildTickerSearchCacheKey,
    CACHE_EXPIRY_HOUR_KST,
    computeEffectiveTtl,
    computeSecondsUntilCacheExpiry,
    MARKET_BRIEFING_CACHE_TTL,
} from '@/infrastructure/cache/config';
import type { Timeframe } from '@/domain/types';

describe('ANALYSIS_CACHE_TTL 상수는', () => {
    describe('타임프레임별 TTL 값이', () => {
        it('5Min은 900초(15분)이다', () => {
            expect(ANALYSIS_CACHE_TTL['5Min']).toBe(900);
        });

        it('15Min은 1800초(30분)이다', () => {
            expect(ANALYSIS_CACHE_TTL['15Min']).toBe(1800);
        });

        it('30Min은 1800초(30분)이다', () => {
            expect(ANALYSIS_CACHE_TTL['30Min']).toBe(1800);
        });

        it('1Hour은 3600초(1시간)이다', () => {
            expect(ANALYSIS_CACHE_TTL['1Hour']).toBe(3600);
        });

        it('4Hour는 14400초(4시간)이다', () => {
            expect(ANALYSIS_CACHE_TTL['4Hour']).toBe(14400);
        });

        it('1Day는 86400초(24시간)이다', () => {
            expect(ANALYSIS_CACHE_TTL['1Day']).toBe(86400);
        });
    });
});

describe('buildAnalysisCacheKey 함수는', () => {
    describe('정상 입력일 때', () => {
        it('analysis:{symbol}:{timeframe} 형식의 키를 반환한다', () => {
            const key = buildAnalysisCacheKey('AAPL', '1Day');
            expect(key).toBe('analysis:AAPL:1Day');
        });

        it('심볼과 타임프레임을 올바르게 조합한다', () => {
            const testCases: Array<[string, Timeframe, string]> = [
                ['TSLA', '5Min', 'analysis:TSLA:5Min'],
                ['NVDA', '15Min', 'analysis:NVDA:15Min'],
                ['AMZN', '30Min', 'analysis:AMZN:30Min'],
                ['MSFT', '1Hour', 'analysis:MSFT:1Hour'],
                ['META', '4Hour', 'analysis:META:4Hour'],
                ['GOOGL', '1Day', 'analysis:GOOGL:1Day'],
            ];
            testCases.forEach(([symbol, timeframe, expected]) => {
                expect(buildAnalysisCacheKey(symbol, timeframe)).toBe(expected);
            });
        });
    });
});

describe('CACHE_EXPIRY_HOUR_KST 상수는', () => {
    it('17이다', () => {
        expect(CACHE_EXPIRY_HOUR_KST).toBe(17);
    });
});

describe('computeSecondsUntilCacheExpiry 함수는', () => {
    describe('KST 17:00 이전일 때', () => {
        it('오늘 KST 17:00까지 남은 초를 반환한다', () => {
            // KST 16:00 = UTC 07:00
            const now = new Date('2024-01-15T07:00:00.000Z');
            const result = computeSecondsUntilCacheExpiry(now);
            // KST 17:00 = UTC 08:00 → 3600초 남음
            expect(result).toBe(3600);
        });

        it('KST 17:00 1초 전이면 1초를 반환한다', () => {
            // KST 16:59:59 = UTC 07:59:59
            const now = new Date('2024-01-15T07:59:59.000Z');
            const result = computeSecondsUntilCacheExpiry(now);
            expect(result).toBe(1);
        });

        it('KST 17:00까지 1초 미만 남아 있으면 1을 반환한다', () => {
            // 500ms 남은 경우: Math.floor(500/1000) = 0 → Math.max(1, 0) = 1
            const now = new Date('2024-01-15T07:59:59.500Z');
            const result = computeSecondsUntilCacheExpiry(now);
            expect(result).toBe(1);
        });
    });

    describe('KST 17:00 이후일 때', () => {
        it('다음 날 KST 17:00까지 남은 초를 반환한다', () => {
            // KST 18:00 = UTC 09:00
            const now = new Date('2024-01-15T09:00:00.000Z');
            const result = computeSecondsUntilCacheExpiry(now);
            // 다음 날 KST 17:00 = UTC 2024-01-16T08:00:00 → 23시간 = 82800초
            expect(result).toBe(82800);
        });

        it('KST 17:00 정각이면 다음 날 17:00까지 86400초를 반환한다', () => {
            // KST 17:00:00 = UTC 08:00:00
            const now = new Date('2024-01-15T08:00:00.000Z');
            const result = computeSecondsUntilCacheExpiry(now);
            expect(result).toBe(86400);
        });
    });

    describe('자정 경계일 때', () => {
        it('KST 자정(00:00)이면 오늘 KST 17:00까지 61200초를 반환한다', () => {
            // KST 00:00 = UTC 전날 15:00
            const now = new Date('2024-01-14T15:00:00.000Z');
            const result = computeSecondsUntilCacheExpiry(now);
            // KST 17:00 = UTC 2024-01-15T08:00:00 → 17시간 = 61200초
            expect(result).toBe(61200);
        });
    });
});

describe('computeEffectiveTtl 함수는', () => {
    describe('KST 17:00까지 남은 시간이 타임프레임 TTL보다 짧을 때', () => {
        it('KST 17:00까지 남은 초를 반환한다', () => {
            // KST 16:59 = UTC 07:59 → 60초 남음
            const now = new Date('2024-01-15T07:59:00.000Z');
            // 1Day TTL은 86400초인데 KST 17:00까지 60초만 남음
            const result = computeEffectiveTtl('1Day', now);
            expect(result).toBe(60);
        });

        it('모든 타임프레임에 동일하게 적용된다', () => {
            const now = new Date('2024-01-15T07:59:30.000Z');
            const secondsUntilKst17 = 30;
            const timeframes: Timeframe[] = [
                '5Min',
                '15Min',
                '30Min',
                '1Hour',
                '4Hour',
                '1Day',
            ];
            timeframes.forEach(tf => {
                expect(computeEffectiveTtl(tf, now)).toBe(secondsUntilKst17);
            });
        });
    });

    describe('KST 17:00까지 남은 시간이 타임프레임 TTL보다 길 때', () => {
        it('타임프레임 TTL을 반환한다', () => {
            // KST 09:00 = UTC 00:00 → 8시간 = 28800초 남음, 5Min TTL은 900초
            const now = new Date('2024-01-15T00:00:00.000Z');
            const result = computeEffectiveTtl('5Min', now);
            expect(result).toBe(ANALYSIS_CACHE_TTL['5Min']);
        });

        it('1Hour 타임프레임은 1Hour TTL을 반환한다', () => {
            // KST 09:00 = UTC 00:00 → 28800초 남음, 1Hour TTL은 3600초
            const now = new Date('2024-01-15T00:00:00.000Z');
            const result = computeEffectiveTtl('1Hour', now);
            expect(result).toBe(ANALYSIS_CACHE_TTL['1Hour']);
        });
    });
});

describe('MARKET_BRIEFING_CACHE_TTL 상수는', () => {
    it('3600초(1시간)이다', () => {
        expect(MARKET_BRIEFING_CACHE_TTL).toBe(3600);
    });
});

describe('buildBriefingCacheKey 함수는', () => {
    describe('정상 입력일 때', () => {
        it('briefing:market:{dateHour} 형식의 키를 반환한다', () => {
            const key = buildBriefingCacheKey('2026-04-18T14');
            expect(key).toBe('briefing:market:2026-04-18T14');
        });

        it('dateHour 값을 그대로 포함한다', () => {
            const key = buildBriefingCacheKey('2026-01-01T00');
            expect(key).toBe('briefing:market:2026-01-01T00');
        });
    });
});

describe('buildTickerSearchCacheKey 함수는', () => {
    describe('정상 입력일 때', () => {
        it('ticker:search:{query} 형식의 키를 반환한다', () => {
            const key = buildTickerSearchCacheKey('aapl');
            expect(key).toBe('ticker:search:aapl');
        });

        it('대문자 쿼리를 소문자로 변환한다', () => {
            const key = buildTickerSearchCacheKey('AAPL');
            expect(key).toBe('ticker:search:aapl');
        });

        it('혼합 대소문자 쿼리를 소문자로 변환한다', () => {
            const key = buildTickerSearchCacheKey('Apple');
            expect(key).toBe('ticker:search:apple');
        });
    });
});
