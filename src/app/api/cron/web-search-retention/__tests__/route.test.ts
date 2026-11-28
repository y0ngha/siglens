const { afterTasks } = vi.hoisted(() => ({
    afterTasks: [] as Array<() => Promise<void>>,
}));

vi.mock('@/shared/lib/auth/isAuthorizedCronRequest', () => ({
    isAuthorizedCronRequest: vi.fn(),
}));
vi.mock('@/shared/lib/afterWithDrain', () => ({
    afterWithDrain: (task: () => Promise<void>) => afterTasks.push(task),
}));
vi.mock('@/shared/lib/renderBudget', () => ({
    runAsBatchWork: <T>(fn: () => Promise<T>) => fn(),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: { marker: 'db' } })),
}));
vi.mock('@/entities/chat-conversation/api', () => ({
    DrizzleChatConversationRepository: function (db: unknown) {
        return { marker: 'repo', db };
    },
}));
vi.mock(
    '@/entities/chat-conversation/server/stripExpiredWebSearchBodies',
    () => ({ stripExpiredWebSearchBodies: vi.fn() })
);

import { PATCH } from '@/app/api/cron/web-search-retention/route';
import { stripExpiredWebSearchBodies } from '@/entities/chat-conversation/server/stripExpiredWebSearchBodies';
import { MS_PER_MINUTE } from '@/shared/config/time';
import { getDatabaseClient } from '@/shared/db/client';
import { isAuthorizedCronRequest } from '@/shared/lib/auth/isAuthorizedCronRequest';
import { defined } from '@/shared/test-utils/defined';

const request = () =>
    new Request('https://siglens.io/api/cron/web-search-retention', {
        method: 'PATCH',
    });

describe('PATCH /api/cron/web-search-retention', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        afterTasks.length = 0;
        vi.mocked(isAuthorizedCronRequest).mockReturnValue(true);
        vi.mocked(stripExpiredWebSearchBodies).mockResolvedValue({
            scanned: 2,
            rewritten: 2,
            skipped: 0,
            batches: 1,
            more: false,
            failed: false,
        });
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('answers 401 without touching the database or scheduling work when unauthorised', async () => {
        vi.mocked(isAuthorizedCronRequest).mockReturnValue(false);

        const res = await PATCH(request());

        expect(res.status).toBe(401);
        expect(afterTasks).toHaveLength(0);
        expect(getDatabaseClient).not.toHaveBeenCalled();
    });

    it('answers 202 first and runs the retention pass in the after task', async () => {
        const res = await PATCH(request());

        expect(res.status).toBe(202);
        expect(stripExpiredWebSearchBodies).not.toHaveBeenCalled();
        await defined(afterTasks[0])();
        expect(stripExpiredWebSearchBodies).toHaveBeenCalledWith(
            expect.objectContaining({
                repo: expect.objectContaining({ marker: 'repo' }),
                isDeadlineReached: expect.any(Function),
            })
        );
    });

    it('logs the counts on one line', async () => {
        await PATCH(request());
        await defined(afterTasks[0])();

        expect(console.log).toHaveBeenCalledWith(
            '[web-search-retention] run done:',
            JSON.stringify({
                scanned: 2,
                rewritten: 2,
                skipped: 0,
                batches: 1,
                more: false,
                failed: false,
            })
        );
    });

    it('logs a run failure without rejecting the after task', async () => {
        vi.mocked(stripExpiredWebSearchBodies).mockRejectedValue(
            new Error('boom')
        );

        await PATCH(request());
        await expect(defined(afterTasks[0])()).resolves.toBeUndefined();

        expect(console.error).toHaveBeenCalledWith(
            '[web-search-retention] run failed:',
            expect.anything()
        );
    });

    it('reports the deadline as reached only after the 3 minute budget', async () => {
        vi.useFakeTimers();
        try {
            vi.setSystemTime(new Date('2026-11-23T00:00:00Z'));
            let isDeadlineReached: () => boolean = () => false;
            vi.mocked(stripExpiredWebSearchBodies).mockImplementation(
                async options => {
                    isDeadlineReached = defined(options.isDeadlineReached);
                    return {
                        scanned: 0,
                        rewritten: 0,
                        skipped: 0,
                        batches: 0,
                        more: false,
                        failed: false,
                    };
                }
            );
            await PATCH(request());
            await defined(afterTasks[0])();

            expect(isDeadlineReached()).toBe(false);
            vi.advanceTimersByTime(3 * MS_PER_MINUTE - 1);
            expect(isDeadlineReached()).toBe(false);
            vi.advanceTimersByTime(1);
            expect(isDeadlineReached()).toBe(true);
        } finally {
            vi.useRealTimers();
        }
    });
});
