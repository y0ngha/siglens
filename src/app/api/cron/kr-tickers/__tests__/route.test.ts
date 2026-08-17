import { beforeEach, describe, expect, it, vi } from 'vitest';

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

        await runAfterCallback();
        expect(mockSync).toHaveBeenCalledOnce();
    });

    it('동기화가 던져도 after() 콜백이 예외를 밖으로 흘리지 않는다', async () => {
        mockSync.mockRejectedValue(new Error('data.go.kr 503'));
        await PATCH(makeRequest('Bearer test-secret'));

        await expect(runAfterCallback()).resolves.toBeUndefined();
    });
});
