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
vi.mock('@/entities/feedback/api', () => ({
    DrizzleFeedbackRepository: function (db: unknown) {
        return { marker: 'repo', db };
    },
}));
vi.mock('@/shared/email/operatorNotifier', () => ({
    notifyOperator: vi.fn(),
}));
vi.mock('@/app/api/cron/feedback-digest/runFeedbackDigest', () => ({
    runFeedbackDigest: vi.fn(),
}));

import { PATCH } from '@/app/api/cron/feedback-digest/route';
import { runFeedbackDigest } from '@/app/api/cron/feedback-digest/runFeedbackDigest';
import { notifyOperator } from '@/shared/email/operatorNotifier';
import { isAuthorizedCronRequest } from '@/shared/lib/auth/isAuthorizedCronRequest';

const request = () =>
    new Request('https://siglens.io/api/cron/feedback-digest', {
        method: 'PATCH',
    });

describe('PATCH /api/cron/feedback-digest', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        afterTasks.length = 0;
        vi.mocked(isAuthorizedCronRequest).mockReturnValue(true);
        vi.mocked(runFeedbackDigest).mockResolvedValue(undefined);
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('인증이 없으면 401이고 작업을 예약하지 않는다', async () => {
        vi.mocked(isAuthorizedCronRequest).mockReturnValue(false);

        const res = await PATCH(request());

        expect(res.status).toBe(401);
        expect(afterTasks).toHaveLength(0);
    });

    it('202를 먼저 돌려주고 after 작업에서 요약을 실행한다', async () => {
        const res = await PATCH(request());

        expect(res.status).toBe(202);
        expect(runFeedbackDigest).not.toHaveBeenCalled();
        await afterTasks[0]!();
        expect(runFeedbackDigest).toHaveBeenCalledWith(
            expect.any(Date),
            expect.objectContaining({
                repository: expect.objectContaining({ marker: 'repo' }),
                notifier: notifyOperator,
            })
        );
    });

    it('요약이 던져도 after 작업은 삼키고 로그를 남긴다', async () => {
        vi.mocked(runFeedbackDigest).mockRejectedValue(new Error('boom'));

        await PATCH(request());

        await expect(afterTasks[0]!()).resolves.toBeUndefined();
        expect(console.error).toHaveBeenCalledWith(
            '[feedback-digest] run failed:',
            expect.any(Error)
        );
    });
});
