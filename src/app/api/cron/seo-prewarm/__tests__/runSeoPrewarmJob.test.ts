const {
    mockPruneAnalysisHistory,
    mockGetDatabaseClient,
    mockPruneExpiredRows,
} = vi.hoisted(() => ({
    mockPruneAnalysisHistory: vi.fn(),
    mockGetDatabaseClient: vi.fn(),
    mockPruneExpiredRows: vi.fn(),
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
vi.mock('@/entities/options-chain/lib/warmOptionsLastGood', () => ({
    warmOptionsLastGood: vi.fn(),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: mockGetDatabaseClient,
}));
vi.mock('../pruneExpiredRows', () => ({
    pruneExpiredRows: mockPruneExpiredRows,
}));
vi.mock('@/entities/analysis/analysisHistoryRepository', () => ({
    DrizzleAnalysisHistoryRepository: vi.fn().mockImplementation(function () {
        return { pruneAnalysisHistory: mockPruneAnalysisHistory };
    }),
}));

import { warmOptionsLastGood } from '@/entities/options-chain/lib/warmOptionsLastGood';
import { releasePrewarmLock } from '@/app/api/cron/seo-prewarm/lock';
import {
    BATCH_WALL_CLOCK_BUDGET_MS,
    runPrewarmBatch,
} from '@/app/api/cron/seo-prewarm/runPrewarmBatch';
import { runSeoPrewarmJob } from '@/app/api/cron/seo-prewarm/runSeoPrewarmJob';

describe('runSeoPrewarmJob', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.mocked(runPrewarmBatch).mockResolvedValue(
            {} as Awaited<ReturnType<typeof runPrewarmBatch>>
        );
        vi.mocked(warmOptionsLastGood).mockResolvedValue({
            status: 'out_of_window',
        });
        mockGetDatabaseClient.mockReturnValue({ db: {} });
        mockPruneAnalysisHistory.mockResolvedValue({});
        mockPruneExpiredRows.mockResolvedValue({});
    });

    it('락 해제는 받은 토큰으로 한다', async () => {
        await runSeoPrewarmJob('token-1', 1_000);
        expect(releasePrewarmLock).toHaveBeenCalledWith('token-1');
    });

    it('옵션 워밍 마감은 락 획득 시각 + 배치 예산이다', async () => {
        await runSeoPrewarmJob('token-1', 1_000);
        expect(warmOptionsLastGood).toHaveBeenCalledWith(expect.any(Date), {
            budgetEndMs: 1_000 + BATCH_WALL_CLOCK_BUDGET_MS,
        });
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
    });

    describe('정리가 던지면', () => {
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
