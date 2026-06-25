vi.mock('server-only', () => ({}));

const { mockGet, mockSet, mockRedis } = vi.hoisted(() => {
    const mockGet = vi.fn();
    const mockSet = vi.fn();
    const mockRedis: Pick<import('@upstash/redis').Redis, 'get' | 'set'> = {
        get: mockGet,
        set: mockSet,
    };
    return { mockGet, mockSet, mockRedis };
});

vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: vi.fn(() => mockRedis),
}));

import { getRedisClient } from '@/shared/cache/redisClient';
import { createRedisFlag } from '../createRedisFlag';

describe('createRedisFlag', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getRedisClient).mockReturnValue(
            mockRedis as unknown as import('@upstash/redis').Redis
        );
    });

    describe('고정 키(문자열) 모드', () => {
        const flag = createRedisFlag('test:fixed-key', 300, '[testFlag]');

        it('Redis null이면 isSet=false, get 미호출', async () => {
            vi.mocked(getRedisClient).mockReturnValue(null);
            expect(await flag.isSet()).toBe(false);
            expect(mockGet).not.toHaveBeenCalled();
        });

        it('키가 존재하면 isSet=true', async () => {
            mockGet.mockResolvedValue('1');
            expect(await flag.isSet()).toBe(true);
            expect(mockGet).toHaveBeenCalledWith('test:fixed-key');
        });

        it('키가 없으면(null 반환) isSet=false', async () => {
            mockGet.mockResolvedValue(null);
            expect(await flag.isSet()).toBe(false);
        });

        it('mark가 올바른 키와 TTL로 set을 호출한다', async () => {
            mockSet.mockResolvedValue('OK');
            await flag.mark();
            expect(mockSet).toHaveBeenCalledWith('test:fixed-key', '1', {
                ex: 300,
            });
        });

        it('Redis null이면 mark는 noop(throw 없음)', async () => {
            vi.mocked(getRedisClient).mockReturnValue(null);
            await expect(flag.mark()).resolves.toBeUndefined();
            expect(mockSet).not.toHaveBeenCalled();
        });

        it('get 예외를 흡수하고 false 반환', async () => {
            const errSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            mockGet.mockRejectedValue(new Error('down'));
            expect(await flag.isSet()).toBe(false);
            expect(errSpy).toHaveBeenCalledWith(
                '[testFlag] get failed',
                expect.any(Error)
            );
            errSpy.mockRestore();
        });

        it('set 예외를 흡수(throw 안 함)', async () => {
            const errSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            mockSet.mockRejectedValue(new Error('down'));
            await expect(flag.mark()).resolves.toBeUndefined();
            expect(errSpy).toHaveBeenCalledWith(
                '[testFlag] set failed',
                expect.any(Error)
            );
            errSpy.mockRestore();
        });
    });

    describe('함수 키(파라미터) 모드', () => {
        const flag = createRedisFlag(
            (param: string) => `test:param:${param}`,
            600,
            '[paramFlag]'
        );

        it('파라미터가 키로 변환된다', async () => {
            mockGet.mockResolvedValue('1');
            expect(await flag.isSet('abc')).toBe(true);
            expect(mockGet).toHaveBeenCalledWith('test:param:abc');
        });

        it('mark가 파라미터를 키에 반영한다', async () => {
            mockSet.mockResolvedValue('OK');
            await flag.mark('xyz');
            expect(mockSet).toHaveBeenCalledWith('test:param:xyz', '1', {
                ex: 600,
            });
        });
    });
});
