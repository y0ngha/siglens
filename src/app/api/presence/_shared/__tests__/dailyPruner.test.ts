const { mockAfter } = vi.hoisted(() => ({ mockAfter: vi.fn() }));
vi.mock('next/server', () => ({ after: mockAfter }));

import { createDailyPruner } from '../dailyPruner';

async function runAfterCallbacks(): Promise<void> {
    for (const [callback] of mockAfter.mock.calls) {
        await (callback as () => Promise<void>)();
    }
}

describe('createDailyPruner', () => {
    beforeEach(() => {
        mockAfter.mockReset();
    });

    it('같은 KST 날짜에는 한 번만 정리를 예약한다', async () => {
        const prune = createDailyPruner(90, '[test]');
        const repo = { pruneOlderThan: vi.fn().mockResolvedValue(undefined) };

        prune('2026-09-28', repo);
        prune('2026-09-28', repo);
        expect(mockAfter).toHaveBeenCalledOnce();

        await runAfterCallbacks();
        expect(repo.pruneOlderThan).toHaveBeenCalledWith('2026-06-30');
    });

    it('날짜가 바뀌면 다시 예약한다', () => {
        const prune = createDailyPruner(90, '[test]');
        const repo = { pruneOlderThan: vi.fn().mockResolvedValue(undefined) };

        prune('2026-09-28', repo);
        prune('2026-09-29', repo);
        expect(mockAfter).toHaveBeenCalledTimes(2);
    });

    it('정리 실패는 로그만 남기고 삼킨다', async () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        const prune = createDailyPruner(90, '[test]');
        const repo = {
            pruneOlderThan: vi.fn().mockRejectedValue(new Error('db down')),
        };

        prune('2026-09-28', repo);
        await expect(runAfterCallbacks()).resolves.toBeUndefined();
        expect(errorSpy).toHaveBeenCalledWith(
            '[test] prune failed:',
            expect.any(Error)
        );
        errorSpy.mockRestore();
    });
});
