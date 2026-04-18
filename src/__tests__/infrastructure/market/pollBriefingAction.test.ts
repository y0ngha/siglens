jest.mock('@vercel/functions', () => ({
    waitUntil: (promise: Promise<unknown>) => {
        void promise;
    },
}));
jest.mock('@/infrastructure/jobs/queue');
jest.mock('@/infrastructure/cache/redis');

import { pollBriefingAction } from '@/infrastructure/market/pollBriefingAction';
import {
    getJobStatus,
    getJobResult,
    getJobError,
    cleanupJob,
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

describe('pollBriefingAction 함수는', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCreateCacheProvider.mockReturnValue(mockCacheProvider);
        mockCleanupJob.mockResolvedValue(undefined);
        mockCacheSet.mockResolvedValue(undefined);
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
        it('유효한 briefing과 함께 done 상태를 반환한다', async () => {
            mockGetJobStatus.mockResolvedValueOnce('done');
            mockGetJobResult.mockResolvedValueOnce({
                briefing: '시장은 강세입니다.',
            });

            const result = await pollBriefingAction('job-5');

            expect(result).toEqual({
                status: 'done',
                briefing: '시장은 강세입니다.',
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

        it('briefing 필드가 없으면 error를 반환한다', async () => {
            mockGetJobStatus.mockResolvedValueOnce('done');
            mockGetJobResult.mockResolvedValueOnce({ unexpected: 'field' });

            const result = await pollBriefingAction('job-7');

            expect(result).toEqual({
                status: 'error',
                error: 'Invalid briefing result',
            });
        });

        it('done 상태에서 캐시에 브리핑을 저장한다', async () => {
            mockGetJobStatus.mockResolvedValueOnce('done');
            mockGetJobResult.mockResolvedValueOnce({
                briefing: '시장이 상승 중입니다.',
            });

            await pollBriefingAction('job-8');

            await Promise.resolve();
            expect(mockCacheSet).toHaveBeenCalledWith(
                expect.stringContaining('briefing:market:'),
                '시장이 상승 중입니다.',
                expect.any(Number)
            );
        });

        it('캐시 프로바이더가 없어도 done 상태를 반환한다', async () => {
            mockCreateCacheProvider.mockReturnValue(null);
            mockGetJobStatus.mockResolvedValueOnce('done');
            mockGetJobResult.mockResolvedValueOnce({
                briefing: '브리핑 텍스트',
            });

            const result = await pollBriefingAction('job-9');

            expect(result).toEqual({
                status: 'done',
                briefing: '브리핑 텍스트',
            });
            expect(mockCacheSet).not.toHaveBeenCalled();
        });
    });
});
