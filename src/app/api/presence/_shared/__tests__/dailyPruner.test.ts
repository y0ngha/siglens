import { createDailyPruner } from '../dailyPruner';

describe('createDailyPruner', () => {
    it('같은 KST 날짜에는 한 번만 정리한다', async () => {
        const prune = createDailyPruner(90, '[test]');
        const repo = { pruneOlderThan: vi.fn().mockResolvedValue(undefined) };

        await prune('2026-09-28', repo);
        await prune('2026-09-28', repo);

        expect(repo.pruneOlderThan).toHaveBeenCalledOnce();
        expect(repo.pruneOlderThan).toHaveBeenCalledWith('2026-06-30');
    });

    it('날짜가 바뀌면 다시 정리한다', async () => {
        const prune = createDailyPruner(90, '[test]');
        const repo = { pruneOlderThan: vi.fn().mockResolvedValue(undefined) };

        await prune('2026-09-28', repo);
        await prune('2026-09-29', repo);
        expect(repo.pruneOlderThan).toHaveBeenCalledTimes(2);
    });

    it('정리 실패는 로그만 남기고 삼킨다', async () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        const prune = createDailyPruner(90, '[test]');
        const repo = {
            pruneOlderThan: vi.fn().mockRejectedValue(new Error('db down')),
        };

        await expect(prune('2026-09-28', repo)).resolves.toBeUndefined();
        expect(errorSpy).toHaveBeenCalledWith(
            '[test] prune failed:',
            expect.any(Error)
        );
        errorSpy.mockRestore();
    });
});
