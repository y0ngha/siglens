const { mockEval, mockGetRedisClient } = vi.hoisted(() => ({
    mockEval: vi.fn(),
    mockGetRedisClient: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: mockGetRedisClient,
}));

import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    decideMeteredReveal,
    IP_DAILY_SYMBOL_CAP,
    METERED_REVEAL_STARTS_AT,
    nextKstMidnightEpochSeconds,
    type MeteredRevealInput,
} from '@/entities/analysis/server/meteredReveal';

const NOW = new Date('2026-10-18T03:00:00.000Z');
const PEPPER = 'pepper';
const POLICY = { dailySymbols: 1, revealAs: 'member' } as const;

const BASE_INPUT: MeteredRevealInput = {
    guestId: 'guest-1',
    clientIp: '203.0.113.9',
    symbol: 'aapl',
    policy: POLICY,
    now: NOW,
};

function expectedIpKey(kstDate: string, ip: string): string {
    const hash = createHmac('sha256', PEPPER)
        .update(`${kstDate}:${ip}`)
        .digest('hex');
    return `meter:reveal:ip:${kstDate}:${hash}`;
}

describe('decideMeteredReveal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('VISITOR_HASH_PEPPER', PEPPER);
        mockGetRedisClient.mockReturnValue({ eval: mockEval });
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    it('새 종목이면 revealed(isNew)이고 한 번의 EVAL로 판정·기록한다', async () => {
        mockEval.mockResolvedValueOnce(2);

        const decision = await decideMeteredReveal(BASE_INPUT);

        expect(decision).toMatchObject({ state: 'revealed', isNew: true });
        expect(mockEval).toHaveBeenCalledTimes(1);
        const [, keys, args] = mockEval.mock.calls[0];
        expect(keys).toEqual([
            'meter:reveal:g:2026-10-18:guest-1',
            expectedIpKey('2026-10-18', '203.0.113.9'),
        ]);
        expect(args).toEqual([
            'AAPL',
            POLICY.dailySymbols,
            IP_DAILY_SYMBOL_CAP,
            nextKstMidnightEpochSeconds(NOW),
        ]);
    });

    it('원 IP를 키에 남기지 않는다', async () => {
        mockEval.mockResolvedValueOnce(2);

        await decideMeteredReveal(BASE_INPUT);

        const keys = mockEval.mock.calls[0][1] as string[];
        expect(keys.join('|')).not.toContain('203.0.113.9');
    });

    it('이미 공개한 종목을 다시 열면 revealed(isNew 아님)이고 release는 아무것도 하지 않는다', async () => {
        mockEval.mockResolvedValueOnce(1);

        const decision = await decideMeteredReveal(BASE_INPUT);

        expect(decision).toMatchObject({ state: 'revealed', isNew: false });
        if (decision.state !== 'revealed') throw new Error('unreachable');
        await decision.release();
        expect(mockEval).toHaveBeenCalledTimes(1);
    });

    it('다른 종목이 상한을 넘으면 exhausted', async () => {
        mockEval.mockResolvedValueOnce(0);

        await expect(
            decideMeteredReveal({ ...BASE_INPUT, symbol: 'MSFT' })
        ).resolves.toEqual({ state: 'exhausted' });
    });

    it('신규 기록은 release로 두 집합에서 되돌린다', async () => {
        mockEval.mockResolvedValue(2);
        const decision = await decideMeteredReveal(BASE_INPUT);
        if (decision.state !== 'revealed') throw new Error('unreachable');

        await decision.release();

        expect(mockEval).toHaveBeenCalledTimes(2);
        const [script, keys, args] = mockEval.mock.calls[1];
        expect(script).toContain('SREM');
        expect(keys).toEqual(mockEval.mock.calls[0][1]);
        expect(args).toEqual(['AAPL']);
    });

    it('IP 집합엔 이미 있던 종목(3)은 release가 게스트 집합만 되돌린다', async () => {
        mockEval.mockResolvedValue(3);
        const decision = await decideMeteredReveal(BASE_INPUT);
        expect(decision).toMatchObject({ state: 'revealed', isNew: true });
        if (decision.state !== 'revealed') throw new Error('unreachable');

        await decision.release();

        const [script, keys, args] = mockEval.mock.calls[1];
        expect(script).toContain('SREM');
        expect(keys).toEqual(['meter:reveal:g:2026-10-18:guest-1']);
        expect(args).toEqual(['AAPL']);
    });

    // Lua 본문의 동작(SISMEMBER 우선, 두 상한 동시 검사, 두 집합 SADD·EXPIREAT)은 여기서 검증하지
    // 않는다 — `eval`이 mock이라 스크립트를 실행할 수 없고, 문자열 고정은 동작을 보장하지 못한다
    // (TESTING.md#TE-53). 이 파일은 TS 쪽 계약(키·인자·반환값 해석·release 분기)만 고정한다.
    it('release 실패는 삼키고 경고만 남긴다', async () => {
        mockEval.mockResolvedValueOnce(2);
        const decision = await decideMeteredReveal(BASE_INPUT);
        if (decision.state !== 'revealed') throw new Error('unreachable');
        mockEval.mockRejectedValueOnce(new Error('boom'));

        await expect(decision.release()).resolves.toBeUndefined();
        expect(console.warn).toHaveBeenCalledWith(
            expect.stringContaining('[meter]'),
            expect.any(Error)
        );
    });

    it('IP를 모르면 Redis를 건드리지 않고 exhausted', async () => {
        await expect(
            decideMeteredReveal({ ...BASE_INPUT, clientIp: 'unknown' })
        ).resolves.toEqual({ state: 'exhausted' });
        expect(mockGetRedisClient).not.toHaveBeenCalled();
        expect(mockEval).not.toHaveBeenCalled();
    });

    it('게스트 id가 없으면 unavailable', async () => {
        await expect(
            decideMeteredReveal({ ...BASE_INPUT, guestId: null })
        ).resolves.toEqual({ state: 'unavailable' });
        expect(mockEval).not.toHaveBeenCalled();
    });

    it('pepper가 없으면 unavailable이고 경고를 남긴다', async () => {
        vi.stubEnv('VISITOR_HASH_PEPPER', '');

        await expect(decideMeteredReveal(BASE_INPUT)).resolves.toEqual({
            state: 'unavailable',
        });
        expect(console.warn).toHaveBeenCalledWith(
            expect.stringContaining('[meter]')
        );
        expect(mockEval).not.toHaveBeenCalled();
    });

    it('Redis가 설정되지 않았으면 unavailable', async () => {
        mockGetRedisClient.mockReturnValue(null);

        await expect(decideMeteredReveal(BASE_INPUT)).resolves.toEqual({
            state: 'unavailable',
        });
    });

    it('Redis 오류는 unavailable(fail-closed)이고 경고를 남긴다', async () => {
        mockEval.mockRejectedValueOnce(new Error('redis down'));

        await expect(decideMeteredReveal(BASE_INPUT)).resolves.toEqual({
            state: 'unavailable',
        });
        expect(console.warn).toHaveBeenCalledWith(
            expect.stringContaining('[meter]'),
            expect.any(Error)
        );
    });

    it('KST 자정을 넘기면 키의 날짜와 만료 인자가 함께 바뀐다', async () => {
        mockEval.mockResolvedValue(2);
        const beforeMidnight = new Date('2026-10-18T14:59:59.000Z');
        const atMidnight = new Date('2026-10-18T15:00:00.000Z');

        await decideMeteredReveal({ ...BASE_INPUT, now: beforeMidnight });
        await decideMeteredReveal({ ...BASE_INPUT, now: atMidnight });

        const [first, second] = mockEval.mock.calls;
        expect(first[1][0]).toBe('meter:reveal:g:2026-10-18:guest-1');
        expect(second[1][0]).toBe('meter:reveal:g:2026-10-19:guest-1');
        // 18일 만료 = 18일 15:00Z, 19일 만료 = 19일 15:00Z.
        expect(first[2][3]).toBe(Date.parse('2026-10-18T15:00:00Z') / 1000);
        expect(second[2][3]).toBe(Date.parse('2026-10-19T15:00:00Z') / 1000);
    });
});

describe('nextKstMidnightEpochSeconds', () => {
    it('KST 자정 직전과 정각에 서로 다른 다음 자정을 돌려준다', () => {
        expect(
            nextKstMidnightEpochSeconds(new Date('2026-10-18T14:59:59Z'))
        ).toBe(Date.parse('2026-10-18T15:00:00Z') / 1000);
        expect(
            nextKstMidnightEpochSeconds(new Date('2026-10-18T15:00:00Z'))
        ).toBe(Date.parse('2026-10-19T15:00:00Z') / 1000);
    });
});

describe('METERED_REVEAL_STARTS_AT', () => {
    it('KST 2026-10-18 00:00이다', () => {
        expect(METERED_REVEAL_STARTS_AT.toISOString()).toBe(
            '2026-10-17T15:00:00.000Z'
        );
    });
});
