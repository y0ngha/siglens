vi.mock('server-only', () => ({}));

const { mockGetRedisClient, mockRedisGet, mockRedisSet, mockRedisMget } =
    vi.hoisted(() => ({
        mockGetRedisClient: vi.fn(),
        mockRedisGet: vi.fn(),
        mockRedisSet: vi.fn(),
        mockRedisMget: vi.fn(),
    }));

vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: mockGetRedisClient,
}));

import type { SlottedOptionsSnapshot } from '../../lib/optionsSlots';
import {
    LAST_GOOD_MIN_REWRITE_INTERVAL_MS,
    LAST_GOOD_SNAPSHOT_TTL_SECONDS,
    readLastGoodCapturedAtBatch,
    readLastGoodSnapshot,
    shouldRewriteLastGood,
    writeLastGoodSnapshot,
    type RedisClient,
} from '../../server/optionsLastGoodStore';

// 2026-10-05(월) 15:00 UTC = 11:00 ET → 미국 정규장 중.
const SESSION_OPEN_NOW = new Date('2026-10-05T15:00:00.000Z');
// 2026-10-05(월) 05:00 UTC = 01:00 ET → 미국 정규장 밖.
const SESSION_CLOSED_NOW = new Date('2026-10-05T05:00:00.000Z');

const redis = {
    get: mockRedisGet,
    set: mockRedisSet,
    mget: mockRedisMget,
} as unknown as RedisClient;

function snapshot(
    openInterest: number,
    expirationDate: string
): SlottedOptionsSnapshot {
    const contract = {
        contractSymbol: 'AAPL261009C00195000',
        strike: 195,
        lastPrice: 1,
        bid: 1,
        ask: 1,
        volume: 0,
        openInterest,
        impliedVolatility: 0.3,
        inTheMoney: false,
    };
    return {
        symbol: 'AAPL',
        underlyingPrice: 195,
        capturedAt: '2026-10-02T20:00:00.000Z',
        chains: [
            {
                expirationDate,
                daysToExpiration: 7,
                calls: [contract],
                puts: [contract],
            },
        ],
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    mockRedisSet.mockResolvedValue('OK');
});

describe('writeLastGoodSnapshot', () => {
    it('본체와 capturedAt 보조 키를 같은 5일 TTL로 쓴다', async () => {
        const result = await writeLastGoodSnapshot(
            redis,
            'aapl',
            snapshot(500, '2026-10-09')
        );

        expect(result).toBe(true);
        expect(LAST_GOOD_SNAPSHOT_TTL_SECONDS).toBe(432_000);
        expect(mockRedisSet).toHaveBeenCalledTimes(2);
        expect(mockRedisSet.mock.calls[0][0]).toBe(
            'options:snapshot:last-good:v2:AAPL'
        );
        expect(mockRedisSet.mock.calls[0][2]).toEqual({ ex: 432_000 });
        expect(mockRedisSet.mock.calls[1]).toEqual([
            'options:snapshot:last-good-at:v2:AAPL',
            '2026-10-02T20:00:00.000Z',
            { ex: 432_000 },
        ]);
    });

    it('본체 쓰기가 실패하면 false이고 보조 키는 쓰지 않는다', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockRedisSet.mockRejectedValueOnce(new Error('redis down'));

        const result = await writeLastGoodSnapshot(
            redis,
            'AAPL',
            snapshot(500, '2026-10-09')
        );

        expect(result).toBe(false);
        expect(mockRedisSet).toHaveBeenCalledTimes(1);
        errSpy.mockRestore();
    });

    it('보조 키 쓰기만 실패해도 true다', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockRedisSet
            .mockResolvedValueOnce('OK')
            .mockRejectedValueOnce(new Error('redis down'));

        const result = await writeLastGoodSnapshot(
            redis,
            'AAPL',
            snapshot(500, '2026-10-09')
        );

        expect(result).toBe(true);
        errSpy.mockRestore();
    });
});

describe('shouldRewriteLastGood', () => {
    it('정규장 밖이면 보조 키를 읽지 않고 쓴다', async () => {
        await expect(
            shouldRewriteLastGood(redis, 'AAPL', SESSION_CLOSED_NOW)
        ).resolves.toBe(true);
        expect(mockRedisGet).not.toHaveBeenCalled();
    });

    it('정규장 중 capturedAt이 최소 간격 안이면 쓰지 않는다', async () => {
        mockRedisGet.mockResolvedValue(
            new Date(
                SESSION_OPEN_NOW.getTime() -
                    LAST_GOOD_MIN_REWRITE_INTERVAL_MS +
                    1
            ).toISOString()
        );

        await expect(
            shouldRewriteLastGood(redis, 'AAPL', SESSION_OPEN_NOW)
        ).resolves.toBe(false);
        expect(mockRedisGet).toHaveBeenCalledWith(
            'options:snapshot:last-good-at:v2:AAPL'
        );
    });

    it('정규장 중 capturedAt이 최소 간격 이상 지났으면 쓴다', async () => {
        mockRedisGet.mockResolvedValue(
            new Date(
                SESSION_OPEN_NOW.getTime() - LAST_GOOD_MIN_REWRITE_INTERVAL_MS
            ).toISOString()
        );

        await expect(
            shouldRewriteLastGood(redis, 'AAPL', SESSION_OPEN_NOW)
        ).resolves.toBe(true);
    });

    it('보조 키가 문자열이 아니거나 날짜로 읽히지 않으면 쓴다', async () => {
        mockRedisGet.mockResolvedValueOnce(null);
        await expect(
            shouldRewriteLastGood(redis, 'AAPL', SESSION_OPEN_NOW)
        ).resolves.toBe(true);

        mockRedisGet.mockResolvedValueOnce('not-a-date');
        await expect(
            shouldRewriteLastGood(redis, 'AAPL', SESSION_OPEN_NOW)
        ).resolves.toBe(true);
    });

    it('보조 키 읽기가 실패하면 쓴다', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockRedisGet.mockRejectedValue(new Error('redis down'));

        await expect(
            shouldRewriteLastGood(redis, 'AAPL', SESSION_OPEN_NOW)
        ).resolves.toBe(true);
        errSpy.mockRestore();
    });
});

describe('readLastGoodSnapshot', () => {
    it('저장된 값이 없으면 reason=absent다', async () => {
        mockRedisGet.mockResolvedValue(null);

        await expect(
            readLastGoodSnapshot(redis, 'AAPL', SESSION_OPEN_NOW)
        ).resolves.toEqual({ reason: 'absent' });
        expect(mockRedisGet).toHaveBeenCalledWith(
            'options:snapshot:last-good:v2:AAPL'
        );
    });

    it('압축 전 객체는 오늘 기준으로 맞춰 돌려준다', async () => {
        mockRedisGet.mockResolvedValue(snapshot(500, '2026-10-09'));

        const result = await readLastGoodSnapshot(
            redis,
            'AAPL',
            SESSION_CLOSED_NOW
        );

        expect(result).toEqual({
            snapshot: expect.objectContaining({
                capturedAt: '2026-10-02T20:00:00.000Z',
                chains: [
                    expect.objectContaining({
                        expirationDate: '2026-10-09',
                        daysToExpiration: 4,
                    }),
                ],
            }),
        });
    });

    it('맞추고 나면 남는 만기가 없으면 reason=no_expiry_after_rebase다', async () => {
        mockRedisGet.mockResolvedValue(snapshot(500, '2026-10-02'));

        await expect(
            readLastGoodSnapshot(redis, 'AAPL', SESSION_OPEN_NOW)
        ).resolves.toEqual({ reason: 'no_expiry_after_rebase' });
    });

    it('맞춘 결과가 stale이면 reason=stale_after_rebase다', async () => {
        mockRedisGet.mockResolvedValue(snapshot(0, '2026-10-09'));

        await expect(
            readLastGoodSnapshot(redis, 'AAPL', SESSION_OPEN_NOW)
        ).resolves.toEqual({ reason: 'stale_after_rebase' });
    });

    it('읽기가 실패하면 reason=read_error다', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockRedisGet.mockRejectedValue(new Error('redis down'));

        await expect(
            readLastGoodSnapshot(redis, 'AAPL', SESSION_OPEN_NOW)
        ).resolves.toEqual({ reason: 'read_error' });
        errSpy.mockRestore();
    });
});

describe('readLastGoodCapturedAtBatch', () => {
    beforeEach(() => {
        mockGetRedisClient.mockReturnValue(redis);
    });

    it('보조 키를 MGET 한 번으로 읽고 값이 있는 종목만 맵에 담는다', async () => {
        mockRedisMget.mockResolvedValue([
            '2026-10-05T20:30:00.000Z',
            null,
            '2026-10-05T20:40:00.000Z',
        ]);

        const result = await readLastGoodCapturedAtBatch([
            'AAPL',
            'msft',
            'NVDA',
        ]);

        expect(mockRedisMget).toHaveBeenCalledTimes(1);
        expect(mockRedisMget).toHaveBeenCalledWith(
            'options:snapshot:last-good-at:v2:AAPL',
            'options:snapshot:last-good-at:v2:MSFT',
            'options:snapshot:last-good-at:v2:NVDA'
        );
        expect(Object.fromEntries(result)).toEqual({
            AAPL: '2026-10-05T20:30:00.000Z',
            NVDA: '2026-10-05T20:40:00.000Z',
        });
        // 스냅샷 전체 키는 읽지 않는다.
        expect(mockRedisGet).not.toHaveBeenCalled();
    });

    it('문자열이 아닌 값(깨진 데이터)은 미확보로 본다', async () => {
        mockRedisMget.mockResolvedValue([123, { a: 1 }]);

        const result = await readLastGoodCapturedAtBatch(['AAPL', 'MSFT']);

        expect(result.size).toBe(0);
    });

    it('종목이 없으면 Redis를 부르지 않는다', async () => {
        const result = await readLastGoodCapturedAtBatch([]);

        expect(result.size).toBe(0);
        expect(mockRedisMget).not.toHaveBeenCalled();
    });

    it('Redis 오류는 흡수하고 빈 맵이다', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockRedisMget.mockRejectedValue(new Error('redis down'));

        const result = await readLastGoodCapturedAtBatch(['AAPL']);

        expect(result.size).toBe(0);
        expect(errSpy).toHaveBeenCalled();
        errSpy.mockRestore();
    });

    it('Redis가 없으면 빈 맵이다', async () => {
        mockGetRedisClient.mockReturnValue(null);

        const result = await readLastGoodCapturedAtBatch(['AAPL']);

        expect(result.size).toBe(0);
        expect(mockRedisMget).not.toHaveBeenCalled();
    });
});
