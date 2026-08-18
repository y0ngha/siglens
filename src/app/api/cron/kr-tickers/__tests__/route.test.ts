const { mockAfter, mockSync, mockFireAndForget } = vi.hoisted(() => ({
    mockAfter: vi.fn(),
    mockSync: vi.fn(),
    mockFireAndForget: vi.fn(),
}));

vi.mock('next/server', () => ({ after: mockAfter }));
vi.mock('@/entities/ticker', () => ({ fireAndForget: mockFireAndForget }));
vi.mock('@/entities/ticker/lib/syncKrListedTickers', () => ({
    syncKrListedTickers: mockSync,
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { constants } from 'node:http2';
import { PATCH } from '@/app/api/cron/kr-tickers/route';

const { HTTP_STATUS_UNAUTHORIZED, HTTP_STATUS_ACCEPTED } = constants;

function makeRequest(authorization?: string): Request {
    return new Request('http://localhost/api/cron/kr-tickers', {
        method: 'PATCH',
        headers: authorization ? { authorization } : undefined,
    });
}

/** `after()`에 넘어간 콜백을 꺼내 실행한다. */
async function runAfterCallback(): Promise<void> {
    const callback = mockAfter.mock.calls[0]?.[0] as
        | (() => Promise<void>)
        | undefined;
    expect(callback).toBeTypeOf('function');
    await callback!();
}

/**
 * drain promise가 **곧바로** settle되는지 본다.
 *
 * `await expect(p).resolves…`만 쓰면 회귀 시 vitest 기본 타임아웃(5초)까지 매달렸다가
 * "Test timed out"으로 죽는다 — CI에 10초를 얹으면서 무엇이 깨졌는지는 알려주지 않는다.
 * 짧은 sentinel과 race시키면 즉시, 그리고 원인이 드러나는 메시지로 실패한다.
 */
const DRAIN_SETTLE_GRACE_MS = 50;

type DrainOutcome = 'settled' | 'still-pending';

// 반환 타입에 `undefined`가 섞이지 않게 여기서 좁힌다. 호출부는 이미
// `toBeInstanceOf(Promise)`로 거른 뒤라 이 throw는 도달하지 않지만, optional을
// 그대로 흘리면 도달 불가능한 결과가 타입에 남아 읽는 사람을 헷갈리게 한다.
async function settlesPromptly(
    promise: Promise<void> | undefined
): Promise<DrainOutcome> {
    if (!promise) throw new Error('drain promise가 등록되지 않았다');
    return Promise.race<DrainOutcome>([
        promise.then(() => 'settled'),
        new Promise<DrainOutcome>(resolve =>
            setTimeout(() => resolve('still-pending'), DRAIN_SETTLE_GRACE_MS)
        ),
    ]);
}

describe('PATCH /api/cron/kr-tickers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.CRON_SECRET = 'test-secret';
        mockSync.mockResolvedValue({
            fetched: 2_595,
            upserted: 2_595,
            delisted: 1,
            relisted: 0,
            guardTrip: null,
        });
    });

    it('CRON_SECRET이 없으면 401이고 동기화를 예약하지 않는다', async () => {
        delete process.env.CRON_SECRET;
        const res = await PATCH(makeRequest('Bearer test-secret'));
        expect(res.status).toBe(HTTP_STATUS_UNAUTHORIZED);
        expect(mockAfter).not.toHaveBeenCalled();
    });

    it('Bearer 토큰이 틀리면 401', async () => {
        const res = await PATCH(makeRequest('Bearer wrong'));
        expect(res.status).toBe(HTTP_STATUS_UNAUTHORIZED);
        expect(mockAfter).not.toHaveBeenCalled();
    });

    it('Authorization 헤더가 없으면 401', async () => {
        const res = await PATCH(makeRequest());
        expect(res.status).toBe(HTTP_STATUS_UNAUTHORIZED);
    });

    it('인증되면 즉시 202를 반환하고 동기화는 after()로 미룬다', async () => {
        // EventBridge API Destination 타임아웃(~5s)이 전 종목 페이지네이션보다 짧다 —
        // 응답을 기다리면 매일 FailedInvocations가 뜨고 재시도가 붙는다.
        const res = await PATCH(makeRequest('Bearer test-secret'));

        expect(res.status).toBe(HTTP_STATUS_ACCEPTED);
        expect(mockSync).not.toHaveBeenCalled();
        expect(mockAfter).toHaveBeenCalledOnce();
        // SIGTERM drain이 기다릴 수 있도록 promise가 등록돼야 한다.
        expect(mockFireAndForget).toHaveBeenCalledOnce();
        // `fireAndForget`이 *호출*됐다는 것만 보면 그 promise가 영원히 pending이어도
        // 통과한다 — route의 `finally { resolveSync(); }`가 지워지면 SIGTERM/배포 시
        // drain이 그 자리에서 멈춘다. 실제로 settle되는지까지 확인한다.
        const drainPromise = mockFireAndForget.mock.calls[0]?.[0] as
            | Promise<void>
            | undefined;
        expect(drainPromise).toBeInstanceOf(Promise);

        await runAfterCallback();
        expect(mockSync).toHaveBeenCalledOnce();
        await expect(settlesPromptly(drainPromise)).resolves.toBe('settled');
    });

    it('동기화가 던져도 after() 콜백이 예외를 밖으로 흘리지 않는다', async () => {
        mockSync.mockRejectedValue(new Error('data.go.kr 503'));
        await PATCH(makeRequest('Bearer test-secret'));

        const drainPromise = mockFireAndForget.mock.calls[0]?.[0] as
            | Promise<void>
            | undefined;
        expect(drainPromise).toBeInstanceOf(Promise);

        await expect(runAfterCallback()).resolves.toBeUndefined();
        // 동기화가 실패해도 drain은 풀려야 한다 — `finally`가 아니라 try 블록에만
        // resolveSync()를 둔 회귀를 여기서 잡는다.
        await expect(settlesPromptly(drainPromise)).resolves.toBe('settled');
    });
});
