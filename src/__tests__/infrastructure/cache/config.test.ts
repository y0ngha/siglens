import {
    ANALYSIS_CACHE_TTL,
    buildAnalysisCacheKey,
} from '@/infrastructure/cache/config';
import type { Timeframe } from '@/domain/types';

describe('ANALYSIS_CACHE_TTL 상수는', () => {
    describe('타임프레임별 TTL 값이', () => {
        it('1Min은 60초(1분)이다', () => {
            expect(ANALYSIS_CACHE_TTL['1Min']).toBe(60);
        });

        it('5Min은 300초(5분)이다', () => {
            expect(ANALYSIS_CACHE_TTL['5Min']).toBe(300);
        });

        it('15Min은 900초(15분)이다', () => {
            expect(ANALYSIS_CACHE_TTL['15Min']).toBe(900);
        });

        it('1Hour은 3600초(1시간)이다', () => {
            expect(ANALYSIS_CACHE_TTL['1Hour']).toBe(3600);
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
                ['AAPL', '1Min', 'analysis:AAPL:1Min'],
                ['TSLA', '5Min', 'analysis:TSLA:5Min'],
                ['NVDA', '15Min', 'analysis:NVDA:15Min'],
                ['MSFT', '1Hour', 'analysis:MSFT:1Hour'],
                ['GOOGL', '1Day', 'analysis:GOOGL:1Day'],
            ];
            testCases.forEach(([symbol, timeframe, expected]) => {
                expect(buildAnalysisCacheKey(symbol, timeframe)).toBe(expected);
            });
        });
    });
});
