vi.mock('server-only', () => ({}));

const { mockRedis, redisFns } = vi.hoisted(() => {
    const redisFns = {
        get: vi.fn(),
        set: vi.fn(),
        zadd: vi.fn(),
        zrange: vi.fn(),
        zrem: vi.fn(),
        zcard: vi.fn(),
        zremrangebyscore: vi.fn(),
        zremrangebyrank: vi.fn(),
        expire: vi.fn(),
    };
    return { mockRedis: redisFns, redisFns };
});

vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: vi.fn(() => mockRedis),
}));

import { getRedisClient } from '@/shared/cache/redisClient';
import {
    INDEXNOW_BACKOFF_KEY,
    INDEXNOW_DRAIN_LIMIT,
    INDEXNOW_PENDING_KEY,
    INDEXNOW_QUEUE_MAX_ENTRIES,
    drainIndexNow,
    enqueueIndexNow,
} from '../indexNowQueue';
import type { IndexNowOutcome, IndexNowResult } from '../indexNow';

const NOW = new Date('2026-10-05T12:00:00Z');
const DAY = 86_400_000;

function result(outcome: IndexNowOutcome, submitted = 2): IndexNowResult {
    const ok = outcome.kind === 'ok' ? 1 : 0;
    return { submitted, ok, failed: 1 - ok, outcome };
}

/** `console.log`로 나간 순수 JSON 한 줄을 파싱한다. */
function drainLog(logSpy: {
    mock: { calls: readonly unknown[][] };
}): Record<string, unknown> {
    const line = logSpy.mock.calls
        .map(([message]) => String(message))
        .find(message => message.includes('indexnow.drain'));
    expect(line).toBeDefined();
    return JSON.parse(line!);
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRedisClient).mockReturnValue(
        mockRedis as unknown as import('@upstash/redis').Redis
    );
    redisFns.get.mockResolvedValue(null);
    redisFns.set.mockResolvedValue('OK');
    redisFns.zadd.mockResolvedValue(2);
    redisFns.zrange.mockResolvedValue([]);
    redisFns.zrem.mockResolvedValue(0);
    redisFns.zcard.mockResolvedValue(0);
    redisFns.zremrangebyscore.mockResolvedValue(0);
    redisFns.zremrangebyrank.mockResolvedValue(0);
    redisFns.expire.mockResolvedValue(1);
});

describe('enqueueIndexNow', () => {
    it('ZADD NX로 URL을 점수(notBefore ms)와 함께 넣는다 — 이미 있는 URL의 만기를 밀지 않는다', async () => {
        const added = await enqueueIndexNow(
            [
                { url: 'https://siglens.io/AAPL', notBeforeMs: 1000 },
                { url: 'https://siglens.io/AAPL/news', notBeforeMs: 2000 },
            ],
            NOW
        );

        expect(added).toBe(2);
        expect(redisFns.zadd).toHaveBeenCalledWith(
            INDEXNOW_PENDING_KEY,
            { nx: true },
            { member: 'https://siglens.io/AAPL', score: 1000 },
            { member: 'https://siglens.io/AAPL/news', score: 2000 }
        );
    });

    it('같은 URL이 한 호출에 여러 번 와도 첫 값만 쓴다', async () => {
        await enqueueIndexNow(
            [
                { url: 'https://siglens.io/AAPL', notBeforeMs: 1000 },
                { url: 'https://siglens.io/AAPL', notBeforeMs: 9000 },
            ],
            NOW
        );

        const call = redisFns.zadd.mock.calls.find(
            ([key]) => key === INDEXNOW_PENDING_KEY
        );
        expect(call).toHaveLength(3);
        expect(call![2]).toEqual({
            member: 'https://siglens.io/AAPL',
            score: 1000,
        });
    });

    it('넣은 뒤 만기 7일 초과분을 지우고 키 TTL을 14일로 건다', async () => {
        await enqueueIndexNow(
            [{ url: 'https://siglens.io/AAPL', notBeforeMs: 1000 }],
            NOW
        );

        expect(redisFns.zremrangebyscore).toHaveBeenCalledWith(
            INDEXNOW_PENDING_KEY,
            '-inf',
            NOW.getTime() - 7 * DAY
        );
        expect(redisFns.expire).toHaveBeenCalledWith(
            INDEXNOW_PENDING_KEY,
            14 * 86_400
        );
    });

    it('20,000개를 넘으면 가장 오래된(점수가 낮은) 초과분만 지운다', async () => {
        redisFns.zcard.mockResolvedValue(INDEXNOW_QUEUE_MAX_ENTRIES + 5);

        await enqueueIndexNow(
            [{ url: 'https://siglens.io/AAPL', notBeforeMs: 1000 }],
            NOW
        );

        expect(redisFns.zremrangebyrank).toHaveBeenCalledWith(
            INDEXNOW_PENDING_KEY,
            0,
            4
        );
    });

    it('상한 이내면 순위 삭제를 하지 않는다', async () => {
        redisFns.zcard.mockResolvedValue(INDEXNOW_QUEUE_MAX_ENTRIES);

        await enqueueIndexNow(
            [{ url: 'https://siglens.io/AAPL', notBeforeMs: 1000 }],
            NOW
        );

        expect(redisFns.zremrangebyrank).not.toHaveBeenCalled();
    });

    it('빈 입력이나 Redis 부재는 아무것도 하지 않는다', async () => {
        expect(await enqueueIndexNow([], NOW)).toBe(0);
        vi.mocked(getRedisClient).mockReturnValue(null);
        expect(
            await enqueueIndexNow(
                [{ url: 'https://siglens.io/AAPL', notBeforeMs: 1 }],
                NOW
            )
        ).toBe(0);
        expect(redisFns.zadd).not.toHaveBeenCalled();
    });
});

describe('drainIndexNow', () => {
    let logSpy: ReturnType<typeof vi.spyOn>;
    const submit =
        vi.fn<(urls: readonly string[]) => Promise<IndexNowResult>>();

    beforeEach(() => {
        logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        submit.mockReset();
        // 기본값은 거부 — 기본 구현이 실제 제출로 새지 않게.
        submit.mockRejectedValue(new Error('submit not stubbed'));
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    /** 만기분 조회(byScore)와 가장 오래된 항목 조회(withScores)를 구분해 답한다. */
    function stubQueue(due: unknown[], oldest: unknown[] = []): void {
        redisFns.zrange.mockImplementation(
            async (
                _key: string,
                _min: number,
                _max: number,
                opts?: { byScore?: boolean; withScores?: boolean }
            ) => (opts?.byScore === true ? due : oldest)
        );
    }

    it('만기분을 최대 10,000개 꺼낸다(점수 0..now)', async () => {
        stubQueue(['https://siglens.io/AAPL']);
        submit.mockResolvedValue(result({ kind: 'ok' }, 1));

        await drainIndexNow(NOW, submit);

        const dueCall = redisFns.zrange.mock.calls.find(
            ([, , , opts]) => opts?.byScore === true
        );
        expect(dueCall).toEqual([
            INDEXNOW_PENDING_KEY,
            0,
            NOW.getTime(),
            { byScore: true, offset: 0, count: INDEXNOW_DRAIN_LIMIT },
        ]);
    });

    it('ok면 가져온 멤버 전부를 지운다', async () => {
        stubQueue(['https://siglens.io/AAPL', 'https://siglens.io/AAPL/news']);
        submit.mockResolvedValue(result({ kind: 'ok' }));

        const drained = await drainIndexNow(NOW, submit);

        expect(submit).toHaveBeenCalledWith([
            'https://siglens.io/AAPL',
            'https://siglens.io/AAPL/news',
        ]);
        expect(redisFns.zrem).toHaveBeenCalledWith(
            INDEXNOW_PENDING_KEY,
            'https://siglens.io/AAPL',
            'https://siglens.io/AAPL/news'
        );
        expect(drained).toMatchObject({ submitted: 2, ok: 1, skipped: null });
    });

    it('Upstash가 JSON으로 읽어 숫자가 된 멤버도 String으로 정규화해 넘긴다', async () => {
        stubQueue([123, 'https://siglens.io/AAPL']);
        submit.mockResolvedValue(result({ kind: 'ok' }));

        await drainIndexNow(NOW, submit);

        expect(submit).toHaveBeenCalledWith(['123', 'https://siglens.io/AAPL']);
    });

    it('429면 지우지 않고 Retry-After초 backoff를 세운다', async () => {
        stubQueue(['https://siglens.io/AAPL']);
        submit.mockResolvedValue(
            result({ kind: 'rateLimited', retryAfterSeconds: 120 }, 1)
        );

        await drainIndexNow(NOW, submit);

        expect(redisFns.zrem).not.toHaveBeenCalled();
        expect(redisFns.set).toHaveBeenCalledWith(INDEXNOW_BACKOFF_KEY, '1', {
            ex: 120,
        });
    });

    it('429에 Retry-After가 없으면 3600초', async () => {
        stubQueue(['https://siglens.io/AAPL']);
        submit.mockResolvedValue(
            result({ kind: 'rateLimited', retryAfterSeconds: null }, 1)
        );

        await drainIndexNow(NOW, submit);

        expect(redisFns.set).toHaveBeenCalledWith(INDEXNOW_BACKOFF_KEY, '1', {
            ex: 3600,
        });
    });

    it('backoff 중에는 제출하지 않고 대기열도 건드리지 않는다', async () => {
        redisFns.get.mockResolvedValue('1');
        stubQueue(['https://siglens.io/AAPL']);

        const drained = await drainIndexNow(NOW, submit);

        expect(submit).not.toHaveBeenCalled();
        expect(redisFns.zrem).not.toHaveBeenCalled();
        expect(drained.skipped).toBe('backoff');
        expect(drainLog(logSpy)).toMatchObject({ outcome: 'backoff' });
    });

    it.each([400, 422])(
        '거절 %i는 URL이 문제라 대기열에서 지우고 에러를 남긴다',
        async status => {
            const errorSpy = vi.spyOn(console, 'error');
            stubQueue(['https://siglens.io/bad']);
            submit.mockResolvedValue(result({ kind: 'rejected', status }, 1));

            await drainIndexNow(NOW, submit);

            expect(redisFns.zrem).toHaveBeenCalledWith(
                INDEXNOW_PENDING_KEY,
                'https://siglens.io/bad'
            );
            expect(
                errorSpy.mock.calls.some(([message]) =>
                    String(message).includes('dropped unsubmittable')
                )
            ).toBe(true);
        }
    );

    it('403(키 검증 실패)은 지우지 않고 1시간 backoff를 세운다 — 깨진 키로 매 tick 다시 POST하지 않는다', async () => {
        stubQueue(['https://siglens.io/AAPL']);
        submit.mockResolvedValue(result({ kind: 'rejected', status: 403 }, 1));

        await drainIndexNow(NOW, submit);

        expect(redisFns.zrem).not.toHaveBeenCalled();
        expect(redisFns.set).toHaveBeenCalledWith(INDEXNOW_BACKOFF_KEY, '1', {
            ex: 3600,
        });
    });

    it('URL 문제(400·422)는 backoff 없이 지우기만 한다', async () => {
        stubQueue(['https://siglens.io/bad']);
        submit.mockResolvedValue(result({ kind: 'rejected', status: 422 }, 1));

        await drainIndexNow(NOW, submit);

        expect(redisFns.zrem).toHaveBeenCalled();
        expect(redisFns.set).not.toHaveBeenCalled();
    });

    it('일시 실패(transient)는 그대로 둔다', async () => {
        stubQueue(['https://siglens.io/AAPL']);
        submit.mockResolvedValue(result({ kind: 'transient', status: 503 }, 1));

        await drainIndexNow(NOW, submit);

        expect(redisFns.zrem).not.toHaveBeenCalled();
        expect(redisFns.set).not.toHaveBeenCalled();
    });

    it('만기분이 없으면 제출하지 않는다', async () => {
        stubQueue([]);

        const drained = await drainIndexNow(NOW, submit);

        expect(submit).not.toHaveBeenCalled();
        expect(drained.skipped).toBe('nothing-due');
    });

    it('disabled(비운영)면 대기열을 건드리지 않는다', async () => {
        stubQueue(['https://siglens.io/AAPL']);
        submit.mockResolvedValue(result({ kind: 'disabled' }, 0));

        await drainIndexNow(NOW, submit);

        expect(redisFns.zrem).not.toHaveBeenCalled();
    });

    it('로그는 순수 JSON 한 줄이고 pending·oldestDueAgeMs를 싣는다', async () => {
        stubQueue(
            ['https://siglens.io/AAPL'],
            // withScores는 [member, score]를 평탄하게 준다(score는 number).
            ['https://siglens.io/old', NOW.getTime() - 3 * 3_600_000]
        );
        redisFns.zcard.mockResolvedValue(7);
        submit.mockResolvedValue(result({ kind: 'transient', status: 503 }, 1));

        await drainIndexNow(NOW, submit);

        expect(drainLog(logSpy)).toEqual({
            event: 'indexnow.drain',
            outcome: 'transient',
            status: 503,
            due: 1,
            pending: 7,
            oldestDueAgeMs: 3 * 3_600_000,
        });
    });

    it('대기열이 비면 oldestDueAgeMs는 0', async () => {
        stubQueue([], []);

        await drainIndexNow(NOW, submit);

        expect(drainLog(logSpy)).toMatchObject({
            pending: 0,
            oldestDueAgeMs: 0,
        });
    });

    it('Redis가 없으면 아무것도 하지 않는다', async () => {
        vi.mocked(getRedisClient).mockReturnValue(null);

        const drained = await drainIndexNow(NOW, submit);

        expect(submit).not.toHaveBeenCalled();
        expect(drained.skipped).toBe('nothing-due');
    });
});
