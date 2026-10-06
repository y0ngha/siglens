/**
 * 옵션 워밍의 시간 경계를 route와 **진짜 warmOptionsLastGood**로 검증한다(route.test.ts는
 * 워밍을 통째로 목 처리한다). Yahoo(`refreshLastGoodSnapshot`)와 Redis는 목이고 네트워크는
 * 타지 않는다.
 */
vi.mock('server-only', () => ({}));

const {
    mockAfter,
    mockPruneAnalysisHistory,
    mockGetDatabaseClient,
    mockRedisGet,
    mockRedisSet,
} = vi.hoisted(() => ({
    mockAfter: vi.fn(),
    mockPruneAnalysisHistory: vi.fn(),
    mockGetDatabaseClient: vi.fn(),
    mockRedisGet: vi.fn(),
    mockRedisSet: vi.fn(),
}));

vi.mock('next/server', () => ({ after: mockAfter }));

vi.mock('../lock', () => ({
    acquirePrewarmLock: vi.fn(),
    releasePrewarmLock: vi.fn(),
}));

// route는 BATCH_WALL_CLOCK_BUDGET_MS(= LOCK_TTL 900s − 안전 여유 60s)만 가져다 쓴다.
vi.mock('../runPrewarmBatch', () => ({
    runPrewarmBatch: vi.fn(),
    BATCH_WALL_CLOCK_BUDGET_MS: 840_000,
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: mockGetDatabaseClient,
}));

vi.mock('@/entities/analysis/analysisHistoryRepository', () => ({
    DrizzleAnalysisHistoryRepository: vi.fn().mockImplementation(function () {
        return { pruneAnalysisHistory: mockPruneAnalysisHistory };
    }),
}));

vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: () => ({ get: mockRedisGet, set: mockRedisSet }),
}));

vi.mock('@/entities/options-chain/lib/optionsDataCache', () => ({
    readLastGoodCapturedAt: vi.fn(),
    refreshLastGoodSnapshot: vi.fn(),
}));

import { PATCH } from '@/app/api/cron/seo-prewarm/route';
import {
    acquirePrewarmLock,
    releasePrewarmLock,
} from '@/app/api/cron/seo-prewarm/lock';
import { runPrewarmBatch } from '@/app/api/cron/seo-prewarm/runPrewarmBatch';
import {
    readLastGoodCapturedAt,
    refreshLastGoodSnapshot,
} from '@/entities/options-chain/lib/optionsDataCache';
import { OPTIONS_WARM_REFRESH_TIMEOUT_MS } from '@/entities/options-chain/lib/warmOptionsLastGood';

const BUDGET_MS = 840_000;
// 2026-10-05(월) 16:30 EDT — 옵션 워밍 구간 안.
const IN_WINDOW = new Date('2026-10-05T20:30:00.000Z');

const batchCounts = {
    harvested: 0,
    revalidated: 0,
    remaining: 0,
    staleTotal: 0,
    durationMs: 1,
    fmpBudgetUsed: 0,
    indexNowSubmitted: 0,
    indexNowOk: 0,
    indexNowFailed: 0,
};

async function startCallback(): Promise<() => Promise<void>> {
    vi.mocked(acquirePrewarmLock).mockResolvedValue('token-1');
    await PATCH(
        new Request('http://localhost/api/cron/seo-prewarm', {
            method: 'PATCH',
            headers: { authorization: 'Bearer test-secret' },
        })
    );
    return mockAfter.mock.calls[0][0] as () => Promise<void>;
}

describe('PATCH /api/cron/seo-prewarm — 옵션 워밍 시간 경계', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(IN_WINDOW);
        process.env.CRON_SECRET = 'test-secret';
        mockGetDatabaseClient.mockReturnValue({ db: {} });
        mockPruneAnalysisHistory.mockResolvedValue({
            rowsDeleted: 0,
            promptsCleared: 0,
        });
        mockRedisGet.mockResolvedValue(null);
        mockRedisSet.mockResolvedValue('OK');
        vi.mocked(runPrewarmBatch).mockResolvedValue(batchCounts);
        vi.mocked(readLastGoodCapturedAt).mockResolvedValue(null);
        vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('멈춘 refresh가 있어도 prune과 락 해제가 진행된다', async () => {
        vi.mocked(refreshLastGoodSnapshot).mockImplementation(
            () => new Promise(() => {})
        );
        const callback = await startCallback();

        const done = callback();
        await vi.advanceTimersByTimeAsync(BUDGET_MS);
        await done;

        expect(refreshLastGoodSnapshot).toHaveBeenCalled();
        expect(mockPruneAnalysisHistory).toHaveBeenCalledTimes(1);
        expect(releasePrewarmLock).toHaveBeenCalledWith('token-1');
    });

    it('워밍은 락 예산 끝(획득 + 840s)을 넘기지 않는다', async () => {
        vi.mocked(refreshLastGoodSnapshot).mockImplementation(
            () => new Promise(() => {})
        );
        const startedAt = Date.now();
        const callback = await startCallback();

        const done = callback();
        await vi.advanceTimersByTimeAsync(BUDGET_MS);
        await done;

        expect(Date.now() - startedAt).toBeLessThanOrEqual(BUDGET_MS);
    });

    it('Redis 호출이 멈춰도(안전망) 예산 끝에서 끊고 prune과 락 해제를 진행한다', async () => {
        mockRedisGet.mockImplementation(() => new Promise(() => {}));
        const callback = await startCallback();

        const done = callback();
        await vi.advanceTimersByTimeAsync(BUDGET_MS);
        await done;

        expect(refreshLastGoodSnapshot).not.toHaveBeenCalled();
        expect(mockPruneAnalysisHistory).toHaveBeenCalledTimes(1);
        expect(releasePrewarmLock).toHaveBeenCalledWith('token-1');
    });

    it('배치가 예산을 거의 다 썼으면(남은 예산 < 종목 타임아웃) 워밍을 건너뛴다', async () => {
        vi.mocked(runPrewarmBatch).mockImplementation(async () => {
            vi.setSystemTime(
                new Date(
                    Date.now() + BUDGET_MS - OPTIONS_WARM_REFRESH_TIMEOUT_MS + 1
                )
            );
            return batchCounts;
        });
        const callback = await startCallback();

        await callback();

        expect(refreshLastGoodSnapshot).not.toHaveBeenCalled();
        expect(readLastGoodCapturedAt).not.toHaveBeenCalled();
        expect(console.log).toHaveBeenCalledWith(
            '[seo-prewarm] options warm done:',
            JSON.stringify({ status: 'no_budget' })
        );
        expect(mockPruneAnalysisHistory).toHaveBeenCalledTimes(1);
        expect(releasePrewarmLock).toHaveBeenCalledWith('token-1');
    });
});
