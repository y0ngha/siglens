const {
    mockPruneAnalysisHistory,
    mockGetDatabaseClient,
    mockPruneExpiredRows,
    mockRecordSignalHistory,
} = vi.hoisted(() => ({
    mockPruneAnalysisHistory: vi.fn(),
    mockGetDatabaseClient: vi.fn(),
    mockPruneExpiredRows: vi.fn(),
    mockRecordSignalHistory: vi.fn(),
}));

// 실제 상수(`runPrewarmBatch`가 락 모듈 상수에서 파생)를 살리려고 나머지는 원본을 쓴다.
vi.mock('../lock', async importOriginal => ({
    ...(await importOriginal<typeof import('../lock')>()),
    releasePrewarmLock: vi.fn(),
}));
vi.mock('../runPrewarmBatch', async importOriginal => ({
    ...(await importOriginal<typeof import('../runPrewarmBatch')>()),
    runPrewarmBatch: vi.fn(),
}));
vi.mock('@/entities/options-chain/server/warmOptionsLastGood', () => ({
    warmOptionsLastGood: vi.fn(),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: mockGetDatabaseClient,
}));
vi.mock('../pruneExpiredRows', () => ({
    pruneExpiredRows: mockPruneExpiredRows,
}));
vi.mock('../recordSignalHistory', () => ({
    recordSignalHistory: mockRecordSignalHistory,
}));
vi.mock('@/entities/analysis/analysisHistoryRepository', () => ({
    DrizzleAnalysisHistoryRepository: vi.fn().mockImplementation(function () {
        return { pruneAnalysisHistory: mockPruneAnalysisHistory };
    }),
}));

import { warmOptionsLastGood } from '@/entities/options-chain/server/warmOptionsLastGood';
import { releasePrewarmLock } from '@/app/api/cron/seo-prewarm/lock';
import {
    BATCH_WALL_CLOCK_BUDGET_MS,
    runPrewarmBatch,
} from '@/app/api/cron/seo-prewarm/runPrewarmBatch';
import { runSeoPrewarmJob } from '@/app/api/cron/seo-prewarm/runSeoPrewarmJob';

/** 신호 이력 단계의 자기 상한 — 구현 상수와 같은 값(1분)을 테스트가 따로 고정한다. */
const SIGNAL_HISTORY_STEP_MAX_MS = 60_000;

const NOW = new Date('2026-08-03T15:30:00.000Z');

/** 호출 순서 비교용 — 첫 호출의 전역 순번. */
function firstCallOrder(fn: unknown): number {
    const [order] = (fn as { mock: { invocationCallOrder: number[] } }).mock
        .invocationCallOrder;
    return order;
}

describe('runSeoPrewarmJob', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.mocked(runPrewarmBatch).mockResolvedValue({
            harvested: 2,
            revalidated: 3,
            remaining: 4,
            staleTotal: 10,
            durationMs: 1234,
            fmpBudgetUsed: 5,
            indexNowSubmitted: 0,
            indexNowOk: 0,
            indexNowFailed: 0,
        });
        vi.mocked(warmOptionsLastGood).mockResolvedValue({
            status: 'out_of_window',
        });
        vi.mocked(releasePrewarmLock).mockResolvedValue(undefined);
        mockGetDatabaseClient.mockReturnValue({ db: {} });
        mockPruneAnalysisHistory.mockResolvedValue({
            rowsDeleted: 7,
            promptsCleared: 3,
        });
        mockPruneExpiredRows.mockResolvedValue({
            sessionsDeleted: 5,
            sharedAnalysesDeleted: 1,
        });
        mockRecordSignalHistory.mockResolvedValue({
            status: 'done',
            us: { status: 'recorded', sessionDate: '2026-08-03', inserted: 4 },
            kr: { status: 'skipped' },
            pruned: 0,
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('락 해제는 받은 토큰으로 한다', async () => {
        await runSeoPrewarmJob('token-1', 1_000);
        expect(releasePrewarmLock).toHaveBeenCalledWith('token-1');
    });

    it('신호 이력 → 배치 → 옵션 워밍 → 이력 정리 → 만료 행 정리 → 락 해제 순서로 돈다', async () => {
        await runSeoPrewarmJob('token-1', 1_000);
        const order = [
            mockRecordSignalHistory,
            runPrewarmBatch,
            warmOptionsLastGood,
            mockPruneAnalysisHistory,
            mockPruneExpiredRows,
            releasePrewarmLock,
        ].map(firstCallOrder);
        expect(order).toEqual([...order].sort((a, b) => a - b));
    });

    it('배치 결과를 로그한다', async () => {
        await runSeoPrewarmJob('token-1', 1_000);
        expect(console.log).toHaveBeenCalledWith(
            '[seo-prewarm] batch done:',
            JSON.stringify({
                harvested: 2,
                revalidated: 3,
                remaining: 4,
                staleTotal: 10,
                durationMs: 1234,
                fmpBudgetUsed: 5,
                indexNowSubmitted: 0,
                indexNowOk: 0,
                indexNowFailed: 0,
            })
        );
    });

    it('옵션 워밍은 현재 시각과 락 획득 시각 + 배치 예산 마감으로 부른다', async () => {
        await runSeoPrewarmJob('token-1', 1_000);
        expect(warmOptionsLastGood).toHaveBeenCalledWith(NOW, {
            budgetEndMs: 1_000 + BATCH_WALL_CLOCK_BUDGET_MS,
        });
    });

    it('옵션 워밍 결과를 로그한다', async () => {
        await runSeoPrewarmJob('token-1', 1_000);
        expect(console.log).toHaveBeenCalledWith(
            '[seo-prewarm] options warm done:',
            JSON.stringify({ status: 'out_of_window' })
        );
    });

    it('이력 정리 결과를 로그한다', async () => {
        await runSeoPrewarmJob('token-1', 1_000);
        expect(console.log).toHaveBeenCalledWith(
            '[seo-prewarm] prune done:',
            JSON.stringify({ rowsDeleted: 7, promptsCleared: 3 })
        );
    });

    it('만료 행 정리는 같은 db로 돌고 결과를 로그한다', async () => {
        const db = { marker: 'db' };
        mockGetDatabaseClient.mockReturnValue({ db });
        await runSeoPrewarmJob('token-1', 1_000);
        expect(mockPruneExpiredRows).toHaveBeenCalledWith(db);
        expect(console.log).toHaveBeenCalledWith(
            '[seo-prewarm] expiry prune done:',
            JSON.stringify({ sessionsDeleted: 5, sharedAnalysesDeleted: 1 })
        );
    });

    describe('배치가 던지면', () => {
        beforeEach(() => {
            vi.mocked(runPrewarmBatch).mockRejectedValue(new Error('boom'));
        });

        it('실패를 로그한다', async () => {
            await runSeoPrewarmJob('token-1', 1_000);
            expect(console.error).toHaveBeenCalledWith(
                '[seo-prewarm] batch failed:',
                expect.any(Error)
            );
        });

        it('옵션 워밍은 여전히 돈다', async () => {
            await runSeoPrewarmJob('token-1', 1_000);
            expect(warmOptionsLastGood).toHaveBeenCalledTimes(1);
        });

        it('정리는 여전히 돈다', async () => {
            await runSeoPrewarmJob('token-1', 1_000);
            expect(mockPruneExpiredRows).toHaveBeenCalledTimes(1);
        });

        it('이력 정리는 여전히 돈다', async () => {
            await runSeoPrewarmJob('token-1', 1_000);
            expect(mockPruneAnalysisHistory).toHaveBeenCalledTimes(1);
        });

        it('락은 여전히 해제한다', async () => {
            await runSeoPrewarmJob('token-1', 1_000);
            expect(releasePrewarmLock).toHaveBeenCalledWith('token-1');
        });
    });

    describe('옵션 워밍이 던지면', () => {
        beforeEach(() => {
            vi.mocked(warmOptionsLastGood).mockRejectedValue(new Error('warm'));
        });

        it('실패를 로그한다', async () => {
            await runSeoPrewarmJob('token-1', 1_000);
            expect(console.error).toHaveBeenCalledWith(
                '[seo-prewarm] options warm failed:',
                expect.any(Error)
            );
        });

        it('정리는 여전히 돈다', async () => {
            await runSeoPrewarmJob('token-1', 1_000);
            expect(mockPruneExpiredRows).toHaveBeenCalledTimes(1);
        });

        it('락은 여전히 해제한다', async () => {
            await runSeoPrewarmJob('token-1', 1_000);
            expect(releasePrewarmLock).toHaveBeenCalledWith('token-1');
        });
    });

    it('신호 이력은 같은 db로, 자기 상한과 락 예산 끝 중 이른 쪽까지 돌고 결과를 로그한다', async () => {
        const db = { tag: 'db' };
        mockGetDatabaseClient.mockReturnValue({ db });

        await runSeoPrewarmJob('token-1', NOW.getTime());

        expect(mockRecordSignalHistory).toHaveBeenCalledWith(db, {
            budgetEndMs: Math.min(
                NOW.getTime() + BATCH_WALL_CLOCK_BUDGET_MS,
                NOW.getTime() + SIGNAL_HISTORY_STEP_MAX_MS
            ),
        });
        expect(console.log).toHaveBeenCalledWith(
            '[seo-prewarm] signal history done:',
            expect.stringContaining('"inserted":4')
        );
    });

    describe('신호 이력이 던지면', () => {
        beforeEach(() => {
            mockRecordSignalHistory.mockRejectedValue(new Error('signals'));
        });

        it('실패를 로그한다', async () => {
            await runSeoPrewarmJob('token-1', 1_000);
            expect(console.error).toHaveBeenCalledWith(
                '[seo-prewarm] signal history failed:',
                expect.any(Error)
            );
        });

        it('배치와 정리는 여전히 돈다', async () => {
            await runSeoPrewarmJob('token-1', 1_000);
            expect(runPrewarmBatch).toHaveBeenCalledTimes(1);
            expect(mockPruneExpiredRows).toHaveBeenCalledTimes(1);
        });

        it('락은 여전히 해제한다', async () => {
            await runSeoPrewarmJob('token-1', 1_000);
            expect(releasePrewarmLock).toHaveBeenCalledWith('token-1');
        });
    });

    describe('정리가 던지면', () => {
        beforeEach(() => {
            mockPruneAnalysisHistory.mockRejectedValue(new Error('prune'));
        });

        it('실패를 로그한다', async () => {
            await runSeoPrewarmJob('token-1', 1_000);
            expect(console.error).toHaveBeenCalledWith(
                '[seo-prewarm] prune failed:',
                expect.any(Error)
            );
        });

        it('락은 여전히 해제한다', async () => {
            await runSeoPrewarmJob('token-1', 1_000);
            expect(releasePrewarmLock).toHaveBeenCalledWith('token-1');
        });
    });

    describe('DB 클라이언트 조회가 던지면', () => {
        beforeEach(() => {
            mockGetDatabaseClient.mockImplementation(() => {
                throw new Error('no db');
            });
        });

        it('실패를 로그한다', async () => {
            await runSeoPrewarmJob('token-1', 1_000);
            expect(console.error).toHaveBeenCalledWith(
                '[seo-prewarm] prune failed:',
                expect.any(Error)
            );
        });

        it('락은 여전히 해제한다', async () => {
            await runSeoPrewarmJob('token-1', 1_000);
            expect(releasePrewarmLock).toHaveBeenCalledWith('token-1');
        });
    });

    describe('락 해제가 던지면', () => {
        beforeEach(() => {
            vi.mocked(releasePrewarmLock).mockRejectedValue(
                new Error('redis down')
            );
        });

        it('reject하지 않는다', async () => {
            await expect(
                runSeoPrewarmJob('token-1', 1_000)
            ).resolves.toBeUndefined();
        });

        it('실패를 로그한다', async () => {
            await runSeoPrewarmJob('token-1', 1_000);
            expect(console.error).toHaveBeenCalledWith(
                '[seo-prewarm] lock release failed:',
                expect.any(Error)
            );
        });
    });
});
