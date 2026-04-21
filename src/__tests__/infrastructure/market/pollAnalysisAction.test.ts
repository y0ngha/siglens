jest.mock('@vercel/functions', () => ({
    waitUntil: (promise: Promise<unknown>) => {
        void promise;
    },
}));
jest.mock('@/infrastructure/jobs/queue');
jest.mock('@/infrastructure/cache/redis');
jest.mock('@/infrastructure/skills/loader');
jest.mock('@/domain/analysis/confidence');
jest.mock('@/infrastructure/cache/config', () => ({
    ...jest.requireActual('@/infrastructure/cache/config'),
    computeEffectiveTtl: jest.fn(),
}));

import { pollAnalysisAction } from '@/infrastructure/market/pollAnalysisAction';
import {
    cleanupJob,
    getJobError,
    getJobMeta,
    getJobResult,
    getJobStatus,
} from '@/infrastructure/jobs/queue';
import { createCacheProvider } from '@/infrastructure/cache/redis';
import { FileSkillsLoader } from '@/infrastructure/skills/loader';
import { enrichAnalysisWithConfidence } from '@/domain/analysis/confidence';
import { computeEffectiveTtl } from '@/infrastructure/cache/config';
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
const mockComputeEffectiveTtl = computeEffectiveTtl as jest.MockedFunction<
    typeof computeEffectiveTtl
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

// Upstash get()은 자동 역직렬화된 객체를 반환한다
const VALID_RAW_RESULT = {
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
};

describe('pollAnalysisAction 함수는', () => {
    beforeEach(() => {
        mockGetJobStatus.mockReset();
        mockGetJobResult.mockReset();
        mockGetJobError.mockReset();
        mockGetJobMeta.mockReset();
        mockCleanupJob.mockReset();
        mockCacheSet.mockReset();
        mockEnrich.mockReset();
        mockComputeEffectiveTtl.mockReset();
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
            mockGetJobResult.mockResolvedValueOnce(VALID_RAW_RESULT);
            mockGetJobMeta.mockResolvedValueOnce({
                symbol: 'AAPL',
                timeframe: '1Day',
                skillsDegraded: false,
            });
            mockEnrich.mockReturnValueOnce(mockEnrichedResult);

            const result = await pollAnalysisAction('job-5');

            expect(result.status).toBe('done');
            if (result.status === 'done') {
                expect(result.result).toMatchObject(mockEnrichedResult);
                expect(result.result.analyzedAt).toBeDefined();
            }
            expect(mockEnrich).toHaveBeenCalled();
        });

        it('결과에 필수 필드가 없으면 error를 반환한다', async () => {
            mockGetJobStatus.mockResolvedValueOnce('done');
            mockGetJobResult.mockResolvedValueOnce({ invalid: true });
            mockGetJobMeta.mockResolvedValueOnce(null);

            const result = await pollAnalysisAction('job-invalid');

            expect(result).toEqual({
                status: 'error',
                error: 'Invalid response from worker',
            });
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

        it('Skills 로딩 실패 시에도 done 상태를 반환한다', async () => {
            mockGetJobStatus.mockResolvedValueOnce('done');
            mockGetJobResult.mockResolvedValueOnce(VALID_RAW_RESULT);
            mockGetJobMeta.mockResolvedValueOnce({
                symbol: 'AAPL',
                timeframe: '1Day',
                skillsDegraded: false,
            });
            mockEnrich.mockReturnValueOnce(mockEnrichedResult);
            mockLoadSkills.mockRejectedValueOnce(new Error('load failed'));

            const consoleSpy = jest
                .spyOn(console, 'error')
                .mockImplementation(() => {});

            const result = await pollAnalysisAction('job-7');

            expect(result.status).toBe('done');
            consoleSpy.mockRestore();
        });

        it('meta가 있으면 캐시에 저장한다', async () => {
            mockGetJobStatus.mockResolvedValueOnce('done');
            mockGetJobResult.mockResolvedValueOnce(VALID_RAW_RESULT);
            mockGetJobMeta.mockResolvedValueOnce({
                symbol: 'TSLA',
                timeframe: '1Hour',
                skillsDegraded: false,
            });
            mockEnrich.mockReturnValueOnce(mockEnrichedResult);
            mockCacheSet.mockResolvedValueOnce(undefined);
            mockComputeEffectiveTtl.mockReturnValueOnce(3600);

            await pollAnalysisAction('job-8');

            await Promise.resolve();
            expect(mockCacheSet).toHaveBeenCalledWith(
                'analysis:TSLA:1Hour',
                expect.objectContaining({ skillsDegraded: false }),
                3600
            );
        });

        it('meta.lastClose/atr이 있고 AI SL이 무효하면 reconciledLevels가 병기되고 AI 원본은 불변이다', async () => {
            mockGetJobStatus.mockResolvedValueOnce('done');
            mockGetJobResult.mockResolvedValueOnce(VALID_RAW_RESULT);
            mockGetJobMeta.mockResolvedValueOnce({
                symbol: 'AAPL',
                timeframe: '1Day',
                skillsDegraded: false,
                lastClose: 100,
                atr: 5,
            });
            // enriched 결과에 AI 원본 exit/riskReward를 포함시키고,
            // entryPrices 없이 무효 SL만 두면 postProcess가 reconciledLevels에 fallback(92.5)을 병기해야 한다.
            mockEnrich.mockReturnValueOnce({
                ...mockEnrichedResult,
                actionRecommendation: {
                    positionAnalysis: '분석',
                    entry: '진입',
                    exit: 'AI 원본 exit',
                    riskReward: 'AI 원본 riskReward',
                    entryRecommendation: 'enter',
                    stopLoss: 50, // entry 100에 대해 ATR*5=25 범위 밖 → fallback
                    takeProfitPrices: [110],
                },
            });
            mockComputeEffectiveTtl.mockReturnValueOnce(3600);

            const pollResult = await pollAnalysisAction('job-reconcile');

            expect(pollResult.status).toBe('done');
            if (pollResult.status === 'done') {
                // AI 원본 필드는 그대로 유지
                expect(pollResult.result.actionRecommendation?.stopLoss).toBe(
                    50
                );
                expect(pollResult.result.actionRecommendation?.exit).toBe(
                    'AI 원본 exit'
                );
                expect(pollResult.result.actionRecommendation?.riskReward).toBe(
                    'AI 원본 riskReward'
                );
                // 보정값은 reconciledLevels에 병기
                expect(
                    pollResult.result.actionRecommendation?.reconciledLevels
                        ?.stopLoss
                ).toBeCloseTo(92.5, 3);
                expect(
                    pollResult.result.actionRecommendation?.reconciledLevels
                        ?.exit
                ).toContain('손절 $92.50');
                expect(
                    pollResult.result.actionRecommendation?.reconciledLevels
                        ?.reason
                ).toBeTruthy();
            }
        });
    });
});
