jest.mock('@/infrastructure/jobs/redis');

import {
    cancelJob,
    cleanupJob,
    getJobError,
    getJobMeta,
    getJobResult,
    getJobStatus,
    isJobCancelled,
    setJobMeta,
} from '@/infrastructure/jobs/queue';
import { createJobRedis } from '@/infrastructure/jobs/redis';
import type { JobMeta } from '@/infrastructure/jobs/types';

const mockCreateJobRedis = createJobRedis as jest.MockedFunction<
    typeof createJobRedis
>;

const mockGet = jest.fn();
const mockSet = jest.fn();
const mockDel = jest.fn();

const mockRedis = {
    get: mockGet,
    set: mockSet,
    del: mockDel,
};

describe('jobs/queue 모듈은', () => {
    beforeEach(() => {
        mockGet.mockReset();
        mockSet.mockReset();
        mockDel.mockReset();
        mockCreateJobRedis.mockReset();
    });

    describe('Redis가 null일 때', () => {
        beforeEach(() => {
            mockCreateJobRedis.mockReturnValue(null);
        });

        it('setJobMeta는 아무 작업도 하지 않는다', async () => {
            await setJobMeta('job-1', {
                symbol: 'AAPL',
                timeframe: '1Day',
                skillsDegraded: false,
            });
            expect(mockSet).not.toHaveBeenCalled();
        });

        it('getJobStatus는 null을 반환한다', async () => {
            const result = await getJobStatus('job-1');
            expect(result).toBeNull();
        });

        it('getJobResult는 null을 반환한다', async () => {
            const result = await getJobResult('job-1');
            expect(result).toBeNull();
        });

        it('getJobError는 null을 반환한다', async () => {
            const result = await getJobError('job-1');
            expect(result).toBeNull();
        });

        it('getJobMeta는 null을 반환한다', async () => {
            const result = await getJobMeta('job-1');
            expect(result).toBeNull();
        });

        it('cancelJob은 아무 작업도 하지 않는다', async () => {
            await cancelJob('job-1');
            expect(mockSet).not.toHaveBeenCalled();
        });

        it('isJobCancelled는 false를 반환한다', async () => {
            const result = await isJobCancelled('job-1');
            expect(result).toBe(false);
        });

        it('cleanupJob은 아무 작업도 하지 않는다', async () => {
            await cleanupJob('job-1');
            expect(mockDel).not.toHaveBeenCalled();
        });
    });

    describe('Redis가 정상일 때', () => {
        beforeEach(() => {
            mockCreateJobRedis.mockReturnValue(mockRedis as never);
        });

        it('setJobMeta는 메타 객체를 TTL과 함께 저장한다', async () => {
            const meta: JobMeta = {
                symbol: 'TSLA',
                timeframe: '1Hour',
                skillsDegraded: false,
            };
            mockSet.mockResolvedValueOnce('OK');

            await setJobMeta('job-2', meta);

            expect(mockSet).toHaveBeenCalledWith('job:job-2:meta', meta, {
                ex: 3600,
            });
        });

        it('getJobStatus는 status 키 값을 반환한다', async () => {
            mockGet.mockResolvedValueOnce('processing');

            const result = await getJobStatus('job-3');

            expect(mockGet).toHaveBeenCalledWith('job:job-3:status');
            expect(result).toBe('processing');
        });

        it('getJobResult는 result 키 값을 반환한다', async () => {
            mockGet.mockResolvedValueOnce('{"summary":"test"}');

            const result = await getJobResult('job-4');

            expect(mockGet).toHaveBeenCalledWith('job:job-4:result');
            expect(result).toBe('{"summary":"test"}');
        });

        it('getJobError는 error 키 값을 반환한다', async () => {
            mockGet.mockResolvedValueOnce('API error');

            const result = await getJobError('job-5');

            expect(mockGet).toHaveBeenCalledWith('job:job-5:error');
            expect(result).toBe('API error');
        });

        it('getJobMeta는 Upstash가 반환한 객체를 그대로 반환한다', async () => {
            const meta: JobMeta = {
                symbol: 'AAPL',
                timeframe: '1Day',
                skillsDegraded: false,
            };
            mockGet.mockResolvedValueOnce(meta);

            const result = await getJobMeta('job-6');

            expect(mockGet).toHaveBeenCalledWith('job:job-6:meta');
            expect(result).toEqual(meta);
        });

        it('getJobMeta는 값이 없으면 null을 반환한다', async () => {
            mockGet.mockResolvedValueOnce(null);

            const result = await getJobMeta('job-7');

            expect(result).toBeNull();
        });

        it('cancelJob은 cancelled 키를 TTL과 함께 저장한다', async () => {
            mockSet.mockResolvedValueOnce('OK');

            await cancelJob('job-9');

            expect(mockSet).toHaveBeenCalledWith('job:job-9:cancelled', '1', {
                ex: 3600,
            });
        });

        it('isJobCancelled는 cancelled 키가 "1"이면 true를 반환한다', async () => {
            mockGet.mockResolvedValueOnce('1');

            const result = await isJobCancelled('job-10');

            expect(mockGet).toHaveBeenCalledWith('job:job-10:cancelled');
            expect(result).toBe(true);
        });

        it('isJobCancelled는 cancelled 키가 없으면 false를 반환한다', async () => {
            mockGet.mockResolvedValueOnce(null);

            const result = await isJobCancelled('job-11');

            expect(result).toBe(false);
        });

        it('cleanupJob은 5개의 키를 모두 삭제한다', async () => {
            mockDel.mockResolvedValueOnce(5);

            await cleanupJob('job-8');

            expect(mockDel).toHaveBeenCalledWith(
                'job:job-8:status',
                'job:job-8:result',
                'job:job-8:error',
                'job:job-8:meta',
                'job:job-8:cancelled'
            );
        });
    });
});
