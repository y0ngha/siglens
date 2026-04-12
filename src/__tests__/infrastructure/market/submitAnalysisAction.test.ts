import { EMPTY_SMC_RESULT } from '@/domain/indicators/constants';
import type { AnalyzeVariables, Timeframe } from '@/domain/types';
import type { RunAnalysisResult } from '@/infrastructure/market/analysisApi';

jest.mock('@vercel/functions', () => ({
    waitUntil: (promise: Promise<unknown>) => {
        void promise;
    },
}));
jest.mock('@/infrastructure/cache/redis');
jest.mock('@/infrastructure/jobs/queue');
jest.mock('@/infrastructure/skills/loader');

import { submitAnalysisAction } from '@/infrastructure/market/submitAnalysisAction';
import { createCacheProvider } from '@/infrastructure/cache/redis';
import { setJobMeta } from '@/infrastructure/jobs/queue';
import { FileSkillsLoader } from '@/infrastructure/skills/loader';

const mockCreateCacheProvider = createCacheProvider as jest.MockedFunction<
    typeof createCacheProvider
>;
const mockSetJobMeta = setJobMeta as jest.MockedFunction<typeof setJobMeta>;

const mockCacheGet = jest.fn();
const mockCacheSet = jest.fn();
const mockCacheProvider = {
    get: mockCacheGet,
    set: mockCacheSet,
    delete: jest.fn(),
};

const mockLoadSkills = jest.fn();
(FileSkillsLoader as jest.Mock).mockImplementation(() => ({
    loadSkills: mockLoadSkills,
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

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
        atr: [],
        obv: [],
        parabolicSar: [],
        williamsR: [],
        supertrend: [],
        mfi: [],
        keltnerChannel: [],
        cmf: [],
        donchianChannel: [],
        buySellVolume: [],
        squeezeMomentum: [],
        smc: EMPTY_SMC_RESULT,
    },
};

const mockTimeframe: Timeframe = '1Day';

const mockResult: RunAnalysisResult = {
    summary: '테스트',
    trend: 'bullish' as const,
    indicatorResults: [],
    riskLevel: 'low' as const,
    keyLevels: { support: [], resistance: [] },
    priceTargets: {
        bullish: { targets: [], condition: '' },
        bearish: { targets: [], condition: '' },
    },
    patternSummaries: [],
    strategyResults: [],
    candlePatterns: [],
    trendlines: [],
    skillsDegraded: false,
};

describe('submitAnalysisAction 함수는', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv, WORKER_URL: 'https://worker.test' };
        (FileSkillsLoader as jest.Mock).mockImplementation(() => ({
            loadSkills: mockLoadSkills,
        }));
        mockCreateCacheProvider.mockReturnValue(mockCacheProvider);
        mockLoadSkills.mockResolvedValue([]);
        mockSetJobMeta.mockResolvedValue(undefined);
        mockFetch.mockResolvedValue(new Response('{}', { status: 202 }));
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('입력값이 없으면 에러를 던진다', async () => {
        await expect(
            submitAnalysisAction(
                { symbol: '', bars: [], indicators: mockVariables.indicators },
                mockTimeframe
            )
        ).rejects.toThrow('symbol, bars, and indicators are required');
    });

    describe('캐시 히트일 때', () => {
        it('cached 상태와 함께 결과를 반환한다', async () => {
            mockCacheGet.mockResolvedValueOnce(mockResult);

            const result = await submitAnalysisAction(
                mockVariables,
                mockTimeframe
            );

            expect(result.status).toBe('cached');
            if (result.status === 'cached') {
                expect(result.result).toBe(mockResult);
                expect(result.skillsDegraded).toBe(false);
            }
            expect(mockFetch).not.toHaveBeenCalled();
        });
    });

    describe('캐시 미스일 때', () => {
        beforeEach(() => {
            mockCacheGet.mockResolvedValueOnce(null);
        });

        it('프롬프트를 빌드하고 Worker에 요청을 보낸 뒤 jobId를 반환한다', async () => {
            const result = await submitAnalysisAction(
                mockVariables,
                mockTimeframe
            );

            expect(result.status).toBe('submitted');
            if (result.status === 'submitted') {
                expect(result.jobId).toBeDefined();
                expect(typeof result.jobId).toBe('string');
            }
            expect(mockSetJobMeta).toHaveBeenCalled();
            expect(mockFetch).toHaveBeenCalledWith(
                'https://worker.test/analyze',
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                })
            );
        });

        it('WORKER_URL이 없으면 에러를 던진다', async () => {
            delete process.env.WORKER_URL;

            await expect(
                submitAnalysisAction(mockVariables, mockTimeframe)
            ).rejects.toThrow('WORKER_URL environment variable is not set');
        });

        it('Skills 로딩 실패 시에도 Worker에 요청을 보낸다', async () => {
            const consoleSpy = jest
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            mockLoadSkills.mockRejectedValueOnce(new Error('load failed'));

            const result = await submitAnalysisAction(
                mockVariables,
                mockTimeframe
            );

            expect(result.status).toBe('submitted');
            expect(mockFetch).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    describe('캐시 프로바이더가 없을 때', () => {
        it('캐시 조회를 건너뛰고 Worker에 요청을 보낸다', async () => {
            mockCreateCacheProvider.mockReturnValue(null);

            const result = await submitAnalysisAction(
                mockVariables,
                mockTimeframe
            );

            expect(result.status).toBe('submitted');
            expect(mockCacheGet).not.toHaveBeenCalled();
            expect(mockFetch).toHaveBeenCalled();
        });
    });
});
