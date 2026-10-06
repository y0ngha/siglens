vi.mock('server-only', () => ({}));

const { mockSet, mockDel, mockRedis } = vi.hoisted(() => {
    const mockSet = vi.fn();
    const mockDel = vi.fn();
    const mockRedis: Pick<import('@upstash/redis').Redis, 'set' | 'del'> = {
        set: mockSet,
        del: mockDel,
    };
    return { mockSet, mockDel, mockRedis };
});

vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: vi.fn(() => mockRedis),
}));

import { getRedisClient } from '@/shared/cache/redisClient';
import { createRedisSlot } from '../createRedisSlot';

describe('createRedisSlot', () => {
    const slot = createRedisSlot(
        (id: string) => `test:slot:${id}`,
        600,
        '[testSlot]'
    );

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getRedisClient).mockReturnValue(
            mockRedis as unknown as import('@upstash/redis').Redis
        );
    });

    describe('tryAcquire', () => {
        it('SET NX EX가 OK면 true — 확인과 표시가 한 명령이다', async () => {
            mockSet.mockResolvedValue('OK');

            expect(await slot.tryAcquire('a')).toBe(true);
            expect(mockSet).toHaveBeenCalledWith('test:slot:a', '1', {
                nx: true,
                ex: 600,
            });
        });

        it('이미 서 있으면(SET NX가 null) false', async () => {
            mockSet.mockResolvedValue(null);

            expect(await slot.tryAcquire('a')).toBe(false);
        });

        it('Redis 미설정이면 fail-open(true)', async () => {
            vi.mocked(getRedisClient).mockReturnValue(null);

            expect(await slot.tryAcquire('a')).toBe(true);
            expect(mockSet).not.toHaveBeenCalled();
        });

        it('Redis 장애면 fail-open(true)하고 로그를 남긴다', async () => {
            const errSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            mockSet.mockRejectedValue(new Error('down'));

            expect(await slot.tryAcquire('a')).toBe(true);
            expect(errSpy).toHaveBeenCalledWith(
                '[testSlot] acquire failed',
                expect.any(Error)
            );
            errSpy.mockRestore();
        });
    });

    describe('release', () => {
        it('같은 키를 DEL한다', async () => {
            mockDel.mockResolvedValue(1);

            await slot.release('a');

            expect(mockDel).toHaveBeenCalledWith('test:slot:a');
        });

        it('Redis 장애는 삼킨다', async () => {
            const errSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            mockDel.mockRejectedValue(new Error('down'));

            await expect(slot.release('a')).resolves.toBeUndefined();
            errSpy.mockRestore();
        });

        it('Redis 미설정이면 아무것도 하지 않는다', async () => {
            vi.mocked(getRedisClient).mockReturnValue(null);

            await slot.release('a');

            expect(mockDel).not.toHaveBeenCalled();
        });
    });
});
