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
import {
    releaseMarketBriefingSlot,
    tryAcquireMarketBriefingSlot,
} from '../api/marketBriefingCooldown';

/**
 * 크론과 방문자가 **같은 키**를 잡는다 — 한쪽이 만든 시간엔 다른 쪽이 만들지 않는다.
 * 키 철자는 이 모듈로 옮기기 전 크론이 쓰던 것 그대로여야 배포 순간의 쿨다운이 이어진다.
 */
const US_KEY = 'hub-prewarm:market-briefing-cooldown:us';

describe('marketBriefingCooldown', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getRedisClient).mockReturnValue(
            mockRedis as unknown as import('@upstash/redis').Redis
        );
    });

    describe('tryAcquireMarketBriefingSlot', () => {
        it('SET NX EX 1h로 슬롯을 잡으면 true', async () => {
            mockSet.mockResolvedValue('OK');

            expect(await tryAcquireMarketBriefingSlot('us')).toBe(true);
            expect(mockSet).toHaveBeenCalledWith(US_KEY, '1', {
                nx: true,
                ex: 3600,
            });
        });

        it('이미 잡혀 있으면(SET NX가 null) false', async () => {
            mockSet.mockResolvedValue(null);

            expect(await tryAcquireMarketBriefingSlot('kr')).toBe(false);
        });

        it('Redis 미설정이면 fail-open(true)', async () => {
            vi.mocked(getRedisClient).mockReturnValue(null);

            expect(await tryAcquireMarketBriefingSlot('us')).toBe(true);
            expect(mockSet).not.toHaveBeenCalled();
        });

        it('Redis 장애면 fail-open(true)', async () => {
            const errSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            mockSet.mockRejectedValue(new Error('down'));

            expect(await tryAcquireMarketBriefingSlot('us')).toBe(true);
            errSpy.mockRestore();
        });
    });

    describe('releaseMarketBriefingSlot', () => {
        it('같은 키를 DEL한다', async () => {
            mockDel.mockResolvedValue(1);

            await releaseMarketBriefingSlot('us');

            expect(mockDel).toHaveBeenCalledWith(US_KEY);
        });

        it('Redis 장애는 삼킨다', async () => {
            const errSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            mockDel.mockRejectedValue(new Error('down'));

            await expect(releaseMarketBriefingSlot('us')).resolves.toBe(
                undefined
            );
            errSpy.mockRestore();
        });

        it('Redis 미설정이면 아무것도 하지 않는다', async () => {
            vi.mocked(getRedisClient).mockReturnValue(null);

            await releaseMarketBriefingSlot('us');

            expect(mockDel).not.toHaveBeenCalled();
        });
    });
});
