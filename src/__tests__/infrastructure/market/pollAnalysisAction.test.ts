jest.mock('@vercel/functions', () => ({
    waitUntil: (promise: Promise<unknown>) => {
        void promise;
    },
}));
jest.mock('@/infrastructure/jobs/queue');
jest.mock('@/infrastructure/cache/redis');
jest.mock('@/infrastructure/skills/loader');
jest.mock('@/domain/analysis/confidence');

import { pollAnalysisAction } from '@/infrastructure/market/pollAnalysisAction';
import {
    getJobStatus,
    getJobResult,
    getJobError,
    getJobMeta,
    cleanupJob,
} from '@/infrastructure/jobs/queue';
import { createCacheProvider } from '@/infrastructure/cache/redis';
import { FileSkillsLoader } from '@/infrastructure/skills/loader';
import { enrichAnalysisWithConfidence } from '@/domain/analysis/confidence';
import type { AnalysisResponse } from '@/domain/types';

const mockGetJobStatus = getJobStatus as jest.MockedFunction<
    typeof getJobStatus
>;
const mockGetJobResult = getJobResult as jest.MockedFunction<
    typeof getJobResult
>;
const mockGetJobError = getJobError as jest.MockedFunction<typeof getJobError>;
const mockGetJobMeta = getJobMeta as jest.MockedFunction<typeof getJobMeta>;
const mockCleanupJob = cleanupJob as jest.MockedFunction<typeof cleanupJob>;
const mockCreateCacheProvider = createCacheProvider as jest.MockedFunction<
    typeof createCacheProvider
>;
const mockEnrich = enrichAnalysisWithConfidence as jest.MockedFunction<
    typeof enrichAnalysisWithConfidence
>;

const mockLoadSkills = jest.fn();

const mockCacheSet = jest.fn();
const mockCacheProvider = {
    get: jest.fn(),
    set: mockCacheSet,
    delete: jest.fn(),
};

const mockEnrichedResult: AnalysisResponse = {
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
};

const VALID_RAW_JSON = JSON.stringify({
    summary: 'raw',
    trend: 'bullish',
    indicatorResults: [],
    riskLevel: 'low',
    keyLevels: { support: [], resistance: [] },
    priceTargets: {
        bullish: { targets: [], condition: '' },
        bearish: { targets: [], condition: '' },
    },
    patternSummaries: [],
    strategyResults: [],
    candlePatterns: [],
    trendlines: [],
});

describe('pollAnalysisAction 함수는', () => {
    beforeEach(() => {
        mockGetJobStatus.mockReset();
        mockGetJobResult.mockReset();
        mockGetJobError.mockReset();
        mockGetJobMeta.mockReset();
        mockCleanupJob.mockReset();
        mockCacheSet.mockReset();
        mockEnrich.mockReset();
        mockLoadSkills.mockReset();
        (FileSkillsLoader as jest.Mock).mockImplementation(() => ({
            loadSkills: mockLoadSkills,
        }));
        mockCreateCacheProvider.mockReturnValue(mockCacheProvider);
        mockLoadSkills.mockResolvedValue([
            { name: 'test-skill', content: '', confidenceWeight: 0.8 },
        ]);
        mockCleanupJob.mockResolvedValue(undefined);
        mockCacheSet.mockResolvedValue(undefined);
    });

    describe('status가 null일 때', () => {
        it('processing 상태를 반환한다', async () => {
            mockGetJobStatus.mockResolvedValueOnce(null);

            const result = await pollAnalysisAction('job-1');

            expect(result).toEqual({ status: 'processing' });
        });
    });

    describe('status가 processing일 때', () => {
        it('processing 상태를 반환한다', async () => {
            mockGetJobStatus.mockResolvedValueOnce('processing');

            const result = await pollAnalysisAction('job-2');

            expect(result).toEqual({ status: 'processing' });
        });
    });

    describe('status가 error일 때', () => {
        it('에러 메시지와 함께 error 상태를 반환한다', async () => {
            mockGetJobStatus.mockResolvedValueOnce('error');
            mockGetJobError.mockResolvedValueOnce('Gemini API failed');

            const result = await pollAnalysisAction('job-3');

            expect(result).toEqual({
                status: 'error',
                error: 'Gemini API failed',
            });
        });

        it('에러 메시지가 없으면 Unknown error를 반환한다', async () => {
            mockGetJobStatus.mockResolvedValueOnce('error');
            mockGetJobError.mockResolvedValueOnce(null);

            const result = await pollAnalysisAction('job-4');

            expect(result).toEqual({
                status: 'error',
                error: 'Unknown error',
            });
        });
    });

    describe('status가 done일 때', () => {
        it('결과를 파싱하고 enrich한 뒤 반환한다', async () => {
            mockGetJobStatus.mockResolvedValueOnce('done');
            mockGetJobResult.mockResolvedValueOnce(VALID_RAW_JSON);
            mockGetJobMeta.mockResolvedValueOnce({
                symbol: 'AAPL',
                timeframe: '1Day',
            });
            mockEnrich.mockReturnValueOnce(mockEnrichedResult);

            const result = await pollAnalysisAction('job-5');

            expect(result.status).toBe('done');
            if (result.status === 'done') {
                expect(result.result).toBe(mockEnrichedResult);
                expect(result.skillsDegraded).toBe(false);
            }
            expect(mockEnrich).toHaveBeenCalled();
        });

        it('결과가 유효하지 않은 JSON이면 error를 반환한다', async () => {
            mockGetJobStatus.mockResolvedValueOnce('done');
            mockGetJobResult.mockResolvedValueOnce('not valid json');
            mockGetJobMeta.mockResolvedValueOnce(null);

            const consoleSpy = jest
                .spyOn(console, 'error')
                .mockImplementation(() => {});

            const result = await pollAnalysisAction('job-invalid');

            expect(result).toEqual({
                status: 'error',
                error: 'Invalid response from worker',
            });
            consoleSpy.mockRestore();
        });

        it('결과가 없으면 error를 반환한다', async () => {
            mockGetJobStatus.mockResolvedValueOnce('done');
            mockGetJobResult.mockResolvedValueOnce(null);
            mockGetJobMeta.mockResolvedValueOnce(null);

            const result = await pollAnalysisAction('job-6');

            expect(result).toEqual({
                status: 'error',
                error: 'Result not found',
            });
        });

        it('Skills 로딩 실패 시 skillsDegraded=true를 반환한다', async () => {
            mockGetJobStatus.mockResolvedValueOnce('done');
            mockGetJobResult.mockResolvedValueOnce(VALID_RAW_JSON);
            mockGetJobMeta.mockResolvedValueOnce({
                symbol: 'AAPL',
                timeframe: '1Day',
            });
            mockEnrich.mockReturnValueOnce(mockEnrichedResult);
            mockLoadSkills.mockRejectedValueOnce(new Error('load failed'));

            const consoleSpy = jest
                .spyOn(console, 'error')
                .mockImplementation(() => {});

            const result = await pollAnalysisAction('job-7');

            expect(result.status).toBe('done');
            if (result.status === 'done') {
                expect(result.skillsDegraded).toBe(true);
            }
            consoleSpy.mockRestore();
        });

        it('meta가 있으면 캐시에 저장한다', async () => {
            mockGetJobStatus.mockResolvedValueOnce('done');
            mockGetJobResult.mockResolvedValueOnce(VALID_RAW_JSON);
            mockGetJobMeta.mockResolvedValueOnce({
                symbol: 'TSLA',
                timeframe: '1Hour',
            });
            mockEnrich.mockReturnValueOnce(mockEnrichedResult);
            mockCacheSet.mockResolvedValueOnce(undefined);

            await pollAnalysisAction('job-8');

            await Promise.resolve();
            expect(mockCacheSet).toHaveBeenCalledWith(
                'analysis:TSLA:1Hour',
                expect.objectContaining({ skillsDegraded: false }),
                3600
            );
        });
    });
});
