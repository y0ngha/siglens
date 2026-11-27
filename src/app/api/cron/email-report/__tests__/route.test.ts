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
vi.mock('@/shared/email/dispatcher', () => ({
    createEmailDispatcher: vi.fn(() => ({ sendEmail: vi.fn() })),
}));
vi.mock('@/app/api/cron/mail-alert/scheduleMailAlertPass', () => ({
    scheduleMailAlertPass: vi.fn(),
}));

import { PATCH } from '@/app/api/cron/email-report/route';
import { createEmailReportDeps } from '@/app/api/cron/email-report/createEmailReportDeps';
import { runEmailReportBatch } from '@/app/api/cron/email-report/runEmailReportBatch';
import { scheduleMailAlertPass } from '@/app/api/cron/mail-alert/scheduleMailAlertPass';
import { readEmailReportSecret } from '@/entities/email-report/emailReportSecret';
import { ThrottledEmailDispatcher } from '@/shared/email/ThrottledEmailDispatcher';
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
        expect(scheduleMailAlertPass).not.toHaveBeenCalled();
    });

    it('202를 먼저 돌려주고 같은 시각으로 배치를 돌린다', async () => {
        const res = await PATCH(request());

        expect(res.status).toBe(202);
        expect(runEmailReportBatch).not.toHaveBeenCalled();
        await afterTasks[0]!();
        const [deps, now] = vi.mocked(runEmailReportBatch).mock.calls[0]!;
        expect(deps).toEqual({ marker: 'deps' });
        expect(createEmailReportDeps).toHaveBeenCalledWith(
            's'.repeat(40),
            now,
            expect.any(ThrottledEmailDispatcher)
        );
    });

    it('메일 리포트와 알림 메일 두 패스가 같은 시각·같은 발송기로 시작한다', async () => {
        await PATCH(request());

        const alertCall = vi.mocked(scheduleMailAlertPass).mock.lastCall?.[0];
        await afterTasks[0]?.();
        const reportNow = vi.mocked(runEmailReportBatch).mock.lastCall?.[1];
        const reportDispatcher = vi
            .mocked(createEmailReportDeps)
            .mock.calls.find(([secret]) => secret === 's'.repeat(40))?.[2];
        expect(scheduleMailAlertPass).toHaveBeenCalledTimes(1);
        expect(alertCall?.now).toBe(reportNow);
        expect(alertCall?.dispatcher).toBe(reportDispatcher);
    });

    it('알림 패스 예약이 던져도 202를 돌려주고 메일 리포트 패스는 그대로 돈다', async () => {
        vi.mocked(scheduleMailAlertPass).mockImplementation(() => {
            throw new Error('not in a request scope');
        });

        const res = await PATCH(request());

        expect(res.status).toBe(202);
        expect(afterTasks).toHaveLength(1);
        await afterTasks[0]?.();
        expect(runEmailReportBatch).toHaveBeenCalledTimes(1);
        expect(console.error).toHaveBeenCalledWith(
            '[mail-alert] could not schedule pass:',
            expect.anything()
        );
    });

    it('배치가 던져도 after 작업은 삼킨다', async () => {
        vi.mocked(runEmailReportBatch).mockRejectedValue(new Error('boom'));

        await PATCH(request());

        await expect(afterTasks[0]!()).resolves.toBeUndefined();
    });
});
