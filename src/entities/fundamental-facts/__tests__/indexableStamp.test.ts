const { mockGetRedisClient } = vi.hoisted(() => ({
    mockGetRedisClient: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: mockGetRedisClient,
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    FUNDAMENTAL_INDEXABLE_TTL_SECONDS,
    readFundamentalIndexableMap,
    recordFundamentalIndexable,
} from '../server/indexableStamp';

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('recordFundamentalIndexable', () => {
    it('대문자 키에 y/n을 7일 TTL로 쓴다', async () => {
        const set = vi.fn().mockResolvedValue('OK');
        mockGetRedisClient.mockReturnValue({ set });

        await recordFundamentalIndexable('laes', true);
        await recordFundamentalIndexable('SPY', false);

        expect(set).toHaveBeenNthCalledWith(
            1,
            'fundamental-indexable:v1:LAES',
            'y',
            { ex: FUNDAMENTAL_INDEXABLE_TTL_SECONDS }
        );
        expect(set).toHaveBeenNthCalledWith(
            2,
            'fundamental-indexable:v1:SPY',
            'n',
            { ex: FUNDAMENTAL_INDEXABLE_TTL_SECONDS }
        );
    });

    it('Redis 실패는 삼킨다', async () => {
        mockGetRedisClient.mockReturnValue({
            set: vi.fn().mockRejectedValue(new Error('down')),
        });
        await expect(
            recordFundamentalIndexable('LAES', true)
        ).resolves.toBeUndefined();
    });
});

describe('readFundamentalIndexableMap', () => {
    it('기록된 종목만 맵에 싣는다', async () => {
        const mget = vi.fn().mockResolvedValue(['y', null, 'n']);
        mockGetRedisClient.mockReturnValue({ mget });

        const map = await readFundamentalIndexableMap(['LAES', 'AAPL', 'SPY']);

        expect(mget).toHaveBeenCalledWith(
            'fundamental-indexable:v1:LAES',
            'fundamental-indexable:v1:AAPL',
            'fundamental-indexable:v1:SPY'
        );
        expect(map).toEqual(
            new Map([
                ['LAES', true],
                ['SPY', false],
            ])
        );
    });

    it('Redis가 없거나 실패하면 undefined', async () => {
        mockGetRedisClient.mockReturnValue(null);
        expect(await readFundamentalIndexableMap(['LAES'])).toBeUndefined();

        mockGetRedisClient.mockReturnValue({
            mget: vi.fn().mockRejectedValue(new Error('down')),
        });
        expect(await readFundamentalIndexableMap(['LAES'])).toBeUndefined();
    });
});
