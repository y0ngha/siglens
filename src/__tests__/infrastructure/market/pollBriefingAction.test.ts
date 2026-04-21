jest.mock('@vercel/functions', () => ({
    waitUntil: (promise: Promise<unknown>) => {
        void promise;
    },
}));
jest.mock('@/infrastructure/jobs/queue');
jest.mock('@/infrastructure/cache/redis');

import { pollBriefingAction } from '@/infrastructure/market/pollBriefingAction';
import {
    cleanupJob,
    getJobError,
    getJobResult,
    getJobStatus,
} from '@/infrastructure/jobs/queue';
import { createCacheProvider } from '@/infrastructure/cache/redis';

const mockGetJobStatus = getJobStatus as jest.MockedFunction<
    typeof getJobStatus
>;
const mockGetJobResult = getJobResult as jest.MockedFunction<
    typeof getJobResult
>;
const mockGetJobError = getJobError as jest.MockedFunction<typeof getJobError>;
const mockCleanupJob = cleanupJob as jest.MockedFunction<typeof cleanupJob>;
const mockCreateCacheProvider = createCacheProvider as jest.MockedFunction<
    typeof createCacheProvider
>;

const mockCacheSet = jest.fn();
const mockCacheProvider = {
    get: jest.fn(),
    set: mockCacheSet,
    delete: jest.fn(),
};

const FIXED_NOW = new Date('2026-04-18T14:30:00.000Z');
const FIXED_ISO = FIXED_NOW.toISOString();
const FIXED_DATE_HOUR = '2026-04-18T14';

// raw에는 빈 문자열 테마가 포함돼 있어 normalization 시 필터링된다
const VALID_RAW_BRIEFING = {
    summary: '시장은 강세입니다.',
    dominantThemes: ['기술주 강세', ''],
    sectorAnalysis: {
        leadingSectors: ['XLK'],
        laggingSectors: [],
        performanceDescription: '기술 섹터 주도',
    },
    volatilityAnalysis: { vixLevel: 17.48, description: 'VIX 안정' },
    riskSentiment: '위험 선호',
};

// 빈 문자열 테마가 필터링된 정규화 결과
const NORMALIZED_BRIEFING = {
    summary: '시장은 강세입니다.',
    dominantThemes: ['기술주 강세'],
    sectorAnalysis: {
        leadingSectors: ['XLK'],
        laggingSectors: [],
        performanceDescription: '기술 섹터 주도',
    },
    volatilityAnalysis: { vixLevel: 17.48, description: 'VIX 안정' },
    riskSentiment: '위험 선호',
};

describe('pollBriefingAction 함수는', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers({ now: FIXED_NOW });
        mockCreateCacheProvider.mockReturnValue(mockCacheProvider);
        mockCleanupJob.mockResolvedValue(undefined);
        mockCacheSet.mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('status가 null일 때', () => {
        it('processing 상태를 반환한다', async () => {
            mockGetJobStatus.mockResolvedValueOnce(null);

            const result = await pollBriefingAction('job-1');

            expect(result).toEqual({ status: 'processing' });
        });
    });

    describe('status가 processing일 때', () => {
        it('processing 상태를 반환한다', async () => {
            mockGetJobStatus.mockResolvedValueOnce('processing');

            const result = await pollBriefingAction('job-2');

            expect(result).toEqual({ status: 'processing' });
        });
    });

    describe('status가 error일 때', () => {
        it('에러 메시지와 함께 error 상태를 반환한다', async () => {
            mockGetJobStatus.mockResolvedValueOnce('error');
            mockGetJobError.mockResolvedValueOnce('AI API failed');

            const result = await pollBriefingAction('job-3');

            expect(result).toEqual({ status: 'error', error: 'AI API failed' });
        });

        it('에러 메시지가 없으면 Unknown error를 반환한다', async () => {
            mockGetJobStatus.mockResolvedValueOnce('error');
            mockGetJobError.mockResolvedValueOnce(null);

            const result = await pollBriefingAction('job-4');

            expect(result).toEqual({ status: 'error', error: 'Unknown error' });
        });
    });

    describe('status가 done일 때', () => {
        it('유효한 briefing과 generatedAt과 함께 done 상태를 반환한다', async () => {
            mockGetJobStatus.mockResolvedValueOnce('done');
            mockGetJobResult.mockResolvedValueOnce(VALID_RAW_BRIEFING);

            const result = await pollBriefingAction('job-5');

            expect(result).toEqual({
                status: 'done',
                briefing: NORMALIZED_BRIEFING,
                generatedAt: FIXED_ISO,
            });
        });

        it('결과가 없으면 error를 반환한다', async () => {
            mockGetJobStatus.mockResolvedValueOnce('done');
            mockGetJobResult.mockResolvedValueOnce(null);

            const result = await pollBriefingAction('job-6');

            expect(result).toEqual({
                status: 'error',
                error: 'Result not found',
            });
        });

        it('summary 필드가 없으면 error를 반환한다', async () => {
            mockGetJobStatus.mockResolvedValueOnce('done');
            mockGetJobResult.mockResolvedValueOnce({ unexpected: 'field' });

            const result = await pollBriefingAction('job-7');

            expect(result).toEqual({
                status: 'error',
                error: 'Invalid briefing result',
            });
        });

        it('done 상태에서 정규화된 briefing과 generatedAt을 캐시에 저장한다', async () => {
            mockGetJobStatus.mockResolvedValueOnce('done');
            mockGetJobResult.mockResolvedValueOnce(VALID_RAW_BRIEFING);

            await pollBriefingAction('job-8');

            expect(mockCacheSet).toHaveBeenCalledWith(
                `briefing:market:${FIXED_DATE_HOUR}`,
                { briefing: NORMALIZED_BRIEFING, generatedAt: FIXED_ISO },
                expect.any(Number)
            );
        });

        it('캐시 프로바이더가 없어도 done 상태를 반환한다', async () => {
            mockCreateCacheProvider.mockReturnValue(null);
            mockGetJobStatus.mockResolvedValueOnce('done');
            mockGetJobResult.mockResolvedValueOnce(VALID_RAW_BRIEFING);

            const result = await pollBriefingAction('job-9');

            expect(result).toEqual({
                status: 'done',
                briefing: NORMALIZED_BRIEFING,
                generatedAt: FIXED_ISO,
            });
            expect(mockCacheSet).not.toHaveBeenCalled();
        });
    });
});
