jest.mock('@/infrastructure/jobs/redis');

import {
    setJobMeta,
    getJobStatus,
    getJobResult,
    getJobError,
    getJobMeta,
    cleanupJob,
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

        it('cleanupJob은 아무 작업도 하지 않는다', async () => {
            await cleanupJob('job-1');
            expect(mockDel).not.toHaveBeenCalled();
        });
    });

    describe('Redis가 정상일 때', () => {
        beforeEach(() => {
            mockCreateJobRedis.mockReturnValue(mockRedis as never);
        });

        it('setJobMeta는 JSON 직렬화된 메타를 TTL과 함께 저장한다', async () => {
            const meta: JobMeta = {
                symbol: 'TSLA',
                timeframe: '1Hour',
                skillsDegraded: false,
            };
            mockSet.mockResolvedValueOnce('OK');

            await setJobMeta('job-2', meta);

            expect(mockSet).toHaveBeenCalledWith(
                'job:job-2:meta',
                JSON.stringify(meta),
                { ex: 600 }
            );
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

        it('getJobMeta는 JSON 파싱된 메타를 반환한다', async () => {
            const meta: JobMeta = {
                symbol: 'AAPL',
                timeframe: '1Day',
                skillsDegraded: false,
            };
            mockGet.mockResolvedValueOnce(JSON.stringify(meta));

            const result = await getJobMeta('job-6');

            expect(mockGet).toHaveBeenCalledWith('job:job-6:meta');
            expect(result).toEqual(meta);
        });

        it('getJobMeta는 값이 없으면 null을 반환한다', async () => {
            mockGet.mockResolvedValueOnce(null);

            const result = await getJobMeta('job-7');

            expect(result).toBeNull();
        });

        it('cleanupJob은 4개의 키를 모두 삭제한다', async () => {
            mockDel.mockResolvedValueOnce(4);

            await cleanupJob('job-8');

            expect(mockDel).toHaveBeenCalledWith(
                'job:job-8:status',
                'job:job-8:result',
                'job:job-8:error',
                'job:job-8:meta'
            );
        });
    });
});
