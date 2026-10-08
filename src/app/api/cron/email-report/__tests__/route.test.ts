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
vi.mock('@/entities/email-report/emailReportSecret', () => ({
    readEmailReportSecret: vi.fn(),
}));
vi.mock('@/app/api/cron/email-report/createEmailReportDeps', () => ({
    createEmailReportDeps: vi.fn(() => ({ marker: 'deps' })),
}));
vi.mock('@/app/api/cron/email-report/runEmailReportBatch', () => ({
    runEmailReportBatch: vi.fn(),
}));

import { PATCH } from '@/app/api/cron/email-report/route';
import { createEmailReportDeps } from '@/app/api/cron/email-report/createEmailReportDeps';
import { runEmailReportBatch } from '@/app/api/cron/email-report/runEmailReportBatch';
import { readEmailReportSecret } from '@/entities/email-report/emailReportSecret';
import { isAuthorizedCronRequest } from '@/shared/lib/auth/isAuthorizedCronRequest';

const request = () =>
    new Request('https://siglens.io/api/cron/email-report', {
        method: 'PATCH',
    });

describe('PATCH /api/cron/email-report', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        afterTasks.length = 0;
        vi.mocked(isAuthorizedCronRequest).mockReturnValue(true);
        vi.mocked(readEmailReportSecret).mockReturnValue('s'.repeat(40));
        vi.mocked(runEmailReportBatch).mockResolvedValue({} as never);
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('인증이 없으면 401이고 배치를 예약하지 않는다', async () => {
        vi.mocked(isAuthorizedCronRequest).mockReturnValue(false);

        const res = await PATCH(request());

        expect(res.status).toBe(401);
        expect(afterTasks).toHaveLength(0);
    });

    it('비밀값이 없으면 202로 끝내고 아무것도 보내지 않는다', async () => {
        vi.mocked(readEmailReportSecret).mockReturnValue(null);

        const res = await PATCH(request());

        expect(res.status).toBe(202);
        expect(afterTasks).toHaveLength(0);
    });

    it('202를 먼저 돌려주고 같은 시각으로 배치를 돌린다', async () => {
        const res = await PATCH(request());

        expect(res.status).toBe(202);
        expect(runEmailReportBatch).not.toHaveBeenCalled();
        await afterTasks[0]!();
        const [deps, now] = vi.mocked(runEmailReportBatch).mock.calls[0]!;
        expect(deps).toEqual({ marker: 'deps' });
        expect(createEmailReportDeps).toHaveBeenCalledWith('s'.repeat(40), now);
    });

    it('배치가 던져도 after 작업은 삼킨다', async () => {
        vi.mocked(runEmailReportBatch).mockRejectedValue(new Error('boom'));

        await PATCH(request());

        await expect(afterTasks[0]!()).resolves.toBeUndefined();
    });
});
