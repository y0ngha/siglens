import { analyzeAction } from '@/infrastructure/market/analyzeAction';
import type {
    AnalyzeVariables,
    RawAnalysisResponse,
    Timeframe,
} from '@/domain/types';
import type { RunAnalysisResult } from '@/infrastructure/market/analysisApi';

jest.mock('@vercel/functions', () => ({
    waitUntil: (promise: Promise<unknown>) => {
        void promise;
    },
}));
jest.mock('@/infrastructure/market/analysisApi');
jest.mock('@/infrastructure/cache/redis');

import { runAnalysis } from '@/infrastructure/market/analysisApi';
import { createCacheProvider } from '@/infrastructure/cache/redis';

const mockRunAnalysis = runAnalysis as jest.MockedFunction<typeof runAnalysis>;
const mockCreateCacheProvider = createCacheProvider as jest.MockedFunction<
    typeof createCacheProvider
>;

const mockCacheGet = jest.fn();
const mockCacheSet = jest.fn();
const mockCacheDelete = jest.fn();

const mockCacheProvider = {
    get: mockCacheGet,
    set: mockCacheSet,
    delete: mockCacheDelete,
};

const mockVariables: AnalyzeVariables = {
    symbol: 'AAPL',
    bars: [
        {
            time: 1705312200,
            open: 100,
            high: 105,
            low: 99,
            close: 103,
            volume: 1000000,
        },
    ],
    indicators: {
        macd: [],
        bollinger: [],
        dmi: [],
        stochastic: [],
        stochRsi: [],
        rsi: [],
        cci: [],
        vwap: [],
        ma: {},
        ema: {},
        volumeProfile: null,
        ichimoku: [],
    },
};

const mockTimeframe: Timeframe = '1Day';

const mockRawAnalysis: RawAnalysisResponse = {
    summary: '테스트 분석 요약',
    trend: 'bullish' as const,
    signals: [],
    skillSignals: [],
    riskLevel: 'low' as const,
    keyLevels: { support: [], resistance: [] },
    priceTargets: {
        bullish: { targets: [], condition: '' },
        bearish: { targets: [], condition: '' },
    },
    patternSummaries: [],
    skillResults: [],
    candlePatterns: [],
    trendlines: [],
};

const mockResult: RunAnalysisResult = {
    ...mockRawAnalysis,
    skillsDegraded: false,
    patternSummaries: [],
    skillResults: [],
    candlePatterns: [],
};

describe('analyzeAction 함수는', () => {
    beforeEach(() => {
        mockRunAnalysis.mockReset();
        mockCacheGet.mockReset();
        mockCacheSet.mockReset();
        mockCacheDelete.mockReset();
        mockCreateCacheProvider.mockReturnValue(mockCacheProvider);
    });

    describe('캐시 프로바이더가 없을 때', () => {
        beforeEach(() => {
            mockCreateCacheProvider.mockReturnValue(null);
        });

        it('runAnalysis를 직접 호출하고 결과를 반환한다', async () => {
            mockRunAnalysis.mockResolvedValueOnce(mockResult);

            const result = await analyzeAction(mockVariables, mockTimeframe);

            expect(mockRunAnalysis).toHaveBeenCalledWith(
                mockVariables,
                mockTimeframe
            );
            expect(result).toBe(mockResult);
        });
    });

    describe('캐시 히트일 때', () => {
        it('runAnalysis를 호출하지 않고 캐시 결과를 반환한다', async () => {
            mockCacheGet.mockResolvedValueOnce(mockResult);

            const result = await analyzeAction(mockVariables, mockTimeframe);

            expect(mockCacheGet).toHaveBeenCalledWith('analysis:AAPL:1Day');
            expect(mockRunAnalysis).not.toHaveBeenCalled();
            expect(result).toBe(mockResult);
        });
    });

    describe('캐시 미스일 때', () => {
        it('runAnalysis를 호출하고 결과를 캐시에 저장한 뒤 반환한다', async () => {
            mockCacheGet.mockResolvedValueOnce(null);
            mockRunAnalysis.mockResolvedValueOnce(mockResult);
            mockCacheSet.mockResolvedValueOnce(undefined);

            const result = await analyzeAction(mockVariables, mockTimeframe);

            expect(mockRunAnalysis).toHaveBeenCalledWith(
                mockVariables,
                mockTimeframe
            );
            expect(result).toBe(mockResult);

            // waitUntil로 등록된 백그라운드 작업이 실행되었는지 확인
            await Promise.resolve();
            expect(mockCacheSet).toHaveBeenCalledWith(
                'analysis:AAPL:1Day',
                mockResult,
                86400
            );
        });

        it('타임프레임에 맞는 TTL로 캐시를 저장한다', async () => {
            mockCacheGet.mockResolvedValueOnce(null);
            mockRunAnalysis.mockResolvedValueOnce(mockResult);
            mockCacheSet.mockResolvedValueOnce(undefined);

            await analyzeAction(mockVariables, '1Min');

            await Promise.resolve();
            expect(mockCacheSet).toHaveBeenCalledWith(
                'analysis:AAPL:1Min',
                mockResult,
                60
            );
        });
    });

    describe('캐시 읽기 에러일 때', () => {
        it('에러를 로깅하고 runAnalysis를 실행한 뒤 결과를 캐시에 저장한다', async () => {
            const consoleSpy = jest
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            const cacheError = new Error('Redis 연결 실패');
            mockCacheGet.mockRejectedValueOnce(cacheError);
            mockRunAnalysis.mockResolvedValueOnce(mockResult);
            mockCacheSet.mockResolvedValueOnce(undefined);

            const result = await analyzeAction(mockVariables, mockTimeframe);

            expect(consoleSpy).toHaveBeenCalledWith(
                '[Cache] 캐시 읽기 실패:',
                cacheError
            );
            expect(mockRunAnalysis).toHaveBeenCalledWith(
                mockVariables,
                mockTimeframe
            );
            expect(result).toBe(mockResult);

            // 읽기 에러 후에도 waitUntil로 등록된 캐시 쓰기가 실행되는지 검증
            await Promise.resolve();
            expect(mockCacheSet).toHaveBeenCalledWith(
                'analysis:AAPL:1Day',
                mockResult,
                86400
            );
            consoleSpy.mockRestore();
        });
    });

    describe('캐시 쓰기 에러일 때', () => {
        it('에러를 로깅하고 runAnalysis 결과를 반환한다', async () => {
            const consoleSpy = jest
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            const cacheError = new Error('Redis 쓰기 실패');
            mockCacheGet.mockResolvedValueOnce(null);
            mockRunAnalysis.mockResolvedValueOnce(mockResult);
            mockCacheSet.mockRejectedValueOnce(cacheError);

            const result = await analyzeAction(mockVariables, mockTimeframe);

            expect(result).toBe(mockResult);

            await Promise.resolve();
            expect(consoleSpy).toHaveBeenCalledWith(
                '[Cache] 캐시 쓰기 실패:',
                cacheError
            );
            consoleSpy.mockRestore();
        });
    });

    describe('runAnalysis가 에러를 던질 때', () => {
        it('에러를 전파한다', async () => {
            mockCacheGet.mockResolvedValueOnce(null);
            mockRunAnalysis.mockRejectedValueOnce(new Error('Analysis failed'));

            await expect(
                analyzeAction(mockVariables, mockTimeframe)
            ).rejects.toThrow('Analysis failed');
        });
    });

    describe('force가 true일 때', () => {
        it('캐시를 삭제하고 runAnalysis를 호출한 뒤 결과를 캐시에 저장하고 반환한다', async () => {
            mockCacheDelete.mockResolvedValueOnce(undefined);
            mockRunAnalysis.mockResolvedValueOnce(mockResult);
            mockCacheSet.mockResolvedValueOnce(undefined);

            const result = await analyzeAction(
                mockVariables,
                mockTimeframe,
                true
            );

            expect(mockCacheDelete).toHaveBeenCalledWith('analysis:AAPL:1Day');
            expect(mockCacheGet).not.toHaveBeenCalled();
            expect(mockRunAnalysis).toHaveBeenCalledWith(
                mockVariables,
                mockTimeframe
            );
            expect(result).toBe(mockResult);

            // 강제 재분석 후에도 결과가 캐시에 저장되어야 한다
            await Promise.resolve();
            expect(mockCacheSet).toHaveBeenCalledWith(
                'analysis:AAPL:1Day',
                mockResult,
                86400
            );
        });

        it('캐시 삭제 실패 시 에러를 로깅하고 runAnalysis를 호출한다', async () => {
            const consoleSpy = jest
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            const deleteError = new Error('Redis 삭제 실패');
            mockCacheDelete.mockRejectedValueOnce(deleteError);
            mockRunAnalysis.mockResolvedValueOnce(mockResult);
            mockCacheSet.mockResolvedValueOnce(undefined);

            const result = await analyzeAction(
                mockVariables,
                mockTimeframe,
                true
            );

            expect(consoleSpy).toHaveBeenCalledWith(
                '[Cache] 캐시 삭제 실패:',
                deleteError
            );
            expect(mockRunAnalysis).toHaveBeenCalledWith(
                mockVariables,
                mockTimeframe
            );
            expect(result).toBe(mockResult);

            // 삭제 실패 후에도 runAnalysis 결과가 캐시에 저장되어야 한다
            await Promise.resolve();
            expect(mockCacheSet).toHaveBeenCalledWith(
                'analysis:AAPL:1Day',
                mockResult,
                86400
            );
            consoleSpy.mockRestore();
        });

        it('캐시 프로바이더가 없을 때 runAnalysis를 직접 호출한다', async () => {
            mockCreateCacheProvider.mockReturnValue(null);
            mockRunAnalysis.mockResolvedValueOnce(mockResult);

            const result = await analyzeAction(
                mockVariables,
                mockTimeframe,
                true
            );

            expect(mockCacheDelete).not.toHaveBeenCalled();
            expect(mockRunAnalysis).toHaveBeenCalledWith(
                mockVariables,
                mockTimeframe
            );
            expect(result).toBe(mockResult);
        });
    });
});
