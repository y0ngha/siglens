const { mockAfter, mockPruneAnalysisHistory, mockGetDatabaseClient } =
    vi.hoisted(() => ({
        mockAfter: vi.fn(),
        mockPruneAnalysisHistory: vi.fn(),
        mockGetDatabaseClient: vi.fn(),
    }));

vi.mock('next/server', () => ({ after: mockAfter }));

vi.mock('../lock', () => ({
    acquirePrewarmLock: vi.fn(),
    releasePrewarmLock: vi.fn(),
}));

vi.mock('../runPrewarmBatch', () => ({
    runPrewarmBatch: vi.fn(),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: mockGetDatabaseClient,
}));

// Task S4 — DrizzleAnalysisHistoryRepository is stubbed so route tests only
// verify the cron's own isolation contract (prune never blocks lock
// release), not the repository's own retention logic (covered by
// entities/analysis/__tests__/analysisHistoryRepository.test.ts).
vi.mock('@/entities/analysis/analysisHistoryRepository', () => ({
    // Regular `function` (not an arrow) — the route calls this with `new`,
    // and an explicit-object return from a `new`-invoked function replaces
    // the constructed `this`, giving the caller `{ pruneAnalysisHistory }`.
    DrizzleAnalysisHistoryRepository: vi.fn().mockImplementation(function () {
        return { pruneAnalysisHistory: mockPruneAnalysisHistory };
    }),
}));

import { constants } from 'node:http2';
import { PATCH } from '@/app/api/cron/seo-prewarm/route';
import {
    acquirePrewarmLock,
    releasePrewarmLock,
} from '@/app/api/cron/seo-prewarm/lock';
import { runPrewarmBatch } from '@/app/api/cron/seo-prewarm/runPrewarmBatch';

const {
    HTTP_STATUS_UNAUTHORIZED,
    HTTP_STATUS_NO_CONTENT,
    HTTP_STATUS_ACCEPTED,
} = constants;

function makeRequest(authorization?: string): Request {
    return new Request('http://localhost/api/cron/seo-prewarm', {
        method: 'PATCH',
        headers: authorization ? { authorization } : undefined,
    });
}

describe('PATCH /api/cron/seo-prewarm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.CRON_SECRET = 'test-secret';
        mockGetDatabaseClient.mockReturnValue({ db: {} });
        mockPruneAnalysisHistory.mockResolvedValue({
            rowsDeleted: 0,
            promptsCleared: 0,
        });
    });

    it('CRON_SECRET이 설정되지 않으면 401을 반환한다', async () => {
        delete process.env.CRON_SECRET;
        const res = await PATCH(makeRequest('Bearer test-secret'));
        expect(res.status).toBe(HTTP_STATUS_UNAUTHORIZED);
        expect(acquirePrewarmLock).not.toHaveBeenCalled();
    });

    it('Bearer 토큰이 틀리면 401을 반환한다', async () => {
        const res = await PATCH(makeRequest('Bearer wrong-secret'));
        expect(res.status).toBe(HTTP_STATUS_UNAUTHORIZED);
        expect(acquirePrewarmLock).not.toHaveBeenCalled();
    });

    it('Bearer 토큰이 길이는 같지만 내용이 틀리면 401을 반환한다(timingSafeEqual 경로, length 얼리리턴 아님)', async () => {
        // 'wrongsecret'은 'test-secret'과 동일하게 11자 — `Bearer <secret>` 전체 길이가
        // 같으므로 safeBearerCompare의 `a.length !== b.length` 얼리리턴을 우회하고
        // timingSafeEqual이 실제로 false를 반환하는 경로를 검증한다.
        const res = await PATCH(makeRequest('Bearer wrongsecret'));
        expect(res.status).toBe(HTTP_STATUS_UNAUTHORIZED);
        expect(acquirePrewarmLock).not.toHaveBeenCalled();
    });

    it('Authorization 헤더가 없으면 401을 반환한다', async () => {
        const res = await PATCH(makeRequest());
        expect(res.status).toBe(HTTP_STATUS_UNAUTHORIZED);
    });

    it('Bearer 토큰이 맞아도 락 획득에 실패하면(null) 204를 반환하고 after는 예약되지 않는다', async () => {
        vi.mocked(acquirePrewarmLock).mockResolvedValue(null);
        const res = await PATCH(makeRequest('Bearer test-secret'));
        expect(res.status).toBe(HTTP_STATUS_NO_CONTENT);
        expect(mockAfter).not.toHaveBeenCalled();
    });

    it('Bearer 토큰이 맞고 락을 획득하면(토큰 반환) 202를 즉시 반환하고 after가 1회 예약된다', async () => {
        vi.mocked(acquirePrewarmLock).mockResolvedValue('token-1');
        const res = await PATCH(makeRequest('Bearer test-secret'));
        expect(res.status).toBe(HTTP_STATUS_ACCEPTED);
        expect(mockAfter).toHaveBeenCalledTimes(1);
        expect(runPrewarmBatch).not.toHaveBeenCalled();
    });

    it('예약된 after 콜백을 실행하면 runPrewarmBatch 후 releasePrewarmLock을 획득한 토큰으로 호출한다', async () => {
        vi.mocked(acquirePrewarmLock).mockResolvedValue('token-1');
        vi.mocked(runPrewarmBatch).mockResolvedValue({
            harvested: 2,
            revalidated: 3,
            remaining: 4,
            staleTotal: 10,
            durationMs: 1234,
            fmpBudgetUsed: 5,
        });
        await PATCH(makeRequest('Bearer test-secret'));
        const callback = mockAfter.mock.calls[0][0] as () => Promise<void>;
        await callback();
        expect(runPrewarmBatch).toHaveBeenCalledTimes(1);
        expect(releasePrewarmLock).toHaveBeenCalledTimes(1);
        expect(releasePrewarmLock).toHaveBeenCalledWith('token-1');
    });

    it('배치가 throw해도 releasePrewarmLock을 획득한 토큰으로 호출한다(finally)', async () => {
        vi.mocked(acquirePrewarmLock).mockResolvedValue('token-1');
        vi.mocked(runPrewarmBatch).mockRejectedValue(new Error('boom'));
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        await PATCH(makeRequest('Bearer test-secret'));
        const callback = mockAfter.mock.calls[0][0] as () => Promise<void>;
        await callback();
        expect(releasePrewarmLock).toHaveBeenCalledTimes(1);
        expect(releasePrewarmLock).toHaveBeenCalledWith('token-1');
        errSpy.mockRestore();
    });

    it('FIX H(감사) — acquirePrewarmLock이 throw해도(Upstash 장애) 204를 반환하고 after는 예약되지 않는다', async () => {
        vi.mocked(acquirePrewarmLock).mockRejectedValue(
            new Error('upstash timeout')
        );
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const res = await PATCH(makeRequest('Bearer test-secret'));

        expect(res.status).toBe(HTTP_STATUS_NO_CONTENT);
        expect(mockAfter).not.toHaveBeenCalled();
        expect(runPrewarmBatch).not.toHaveBeenCalled();
        expect(errSpy).toHaveBeenCalledWith(
            '[seo-prewarm] redis unavailable — lock acquire threw:',
            expect.any(Error)
        );

        errSpy.mockRestore();
    });

    it('Task S4 — 배치 성공 후 pruneAnalysisHistory를 호출하고 결과를 로그한 뒤 releasePrewarmLock한다', async () => {
        vi.mocked(acquirePrewarmLock).mockResolvedValue('token-1');
        vi.mocked(runPrewarmBatch).mockResolvedValue({
            harvested: 2,
            revalidated: 3,
            remaining: 4,
            staleTotal: 10,
            durationMs: 1234,
            fmpBudgetUsed: 5,
        });
        mockPruneAnalysisHistory.mockResolvedValue({
            rowsDeleted: 7,
            promptsCleared: 3,
        });
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        await PATCH(makeRequest('Bearer test-secret'));
        const callback = mockAfter.mock.calls[0][0] as () => Promise<void>;
        await callback();

        expect(mockPruneAnalysisHistory).toHaveBeenCalledTimes(1);
        expect(logSpy).toHaveBeenCalledWith(
            '[seo-prewarm] prune done:',
            JSON.stringify({ rowsDeleted: 7, promptsCleared: 3 })
        );
        expect(releasePrewarmLock).toHaveBeenCalledTimes(1);
        expect(releasePrewarmLock).toHaveBeenCalledWith('token-1');

        logSpy.mockRestore();
    });

    it('Task S4 — pruneAnalysisHistory가 throw해도(방어적 격리) cron은 정상 종료하고 releasePrewarmLock을 호출한다', async () => {
        vi.mocked(acquirePrewarmLock).mockResolvedValue('token-1');
        vi.mocked(runPrewarmBatch).mockResolvedValue({
            harvested: 2,
            revalidated: 3,
            remaining: 4,
            staleTotal: 10,
            durationMs: 1234,
            fmpBudgetUsed: 5,
        });
        mockPruneAnalysisHistory.mockRejectedValue(new Error('prune boom'));
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await PATCH(makeRequest('Bearer test-secret'));
        const callback = mockAfter.mock.calls[0][0] as () => Promise<void>;
        await expect(callback()).resolves.toBeUndefined();

        expect(errSpy).toHaveBeenCalledWith(
            '[seo-prewarm] prune failed:',
            expect.any(Error)
        );
        expect(releasePrewarmLock).toHaveBeenCalledTimes(1);
        expect(releasePrewarmLock).toHaveBeenCalledWith('token-1');

        errSpy.mockRestore();
    });
});
