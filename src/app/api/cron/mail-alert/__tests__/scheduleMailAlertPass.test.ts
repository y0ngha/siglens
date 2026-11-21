const { afterTasks } = vi.hoisted(() => ({
    afterTasks: [] as Array<() => Promise<void>>,
}));

vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/afterWithDrain', () => ({
    afterWithDrain: (task: () => Promise<void>) => afterTasks.push(task),
}));
vi.mock('@/shared/lib/renderBudget', () => ({
    runAsBatchWork: <T>(fn: () => Promise<T>) => fn(),
}));
vi.mock('@/entities/email-report/emailReportSecret', () => ({
    readEmailReportSecret: vi.fn(),
}));
vi.mock('@/app/api/cron/mail-alert/createMailAlertDeps', () => ({
    createMailAlertBatchDeps: vi.fn(() => ({ marker: 'deps' })),
}));
vi.mock('@/app/api/cron/mail-alert/runMailAlertBatch', () => ({
    runMailAlertBatch: vi.fn(),
}));

import { createMailAlertBatchDeps } from '@/app/api/cron/mail-alert/createMailAlertDeps';
import { runMailAlertBatch } from '@/app/api/cron/mail-alert/runMailAlertBatch';
import { scheduleMailAlertPass } from '@/app/api/cron/mail-alert/scheduleMailAlertPass';
import { readEmailReportSecret } from '@/entities/email-report/emailReportSecret';
import type { EmailDispatcher } from '@/shared/email/types';

const dispatcher: EmailDispatcher = { sendEmail: async () => true };
const NOW = new Date('2026-11-24T22:05:00Z');

describe('scheduleMailAlertPass', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        afterTasks.length = 0;
        vi.mocked(readEmailReportSecret).mockReturnValue('s'.repeat(40));
        vi.mocked(runMailAlertBatch).mockResolvedValue({
            status: 'outside_window',
        });
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('예약만 하고 그 자리에서는 패스를 돌리지 않는다', () => {
        scheduleMailAlertPass({ now: NOW, dispatcher });

        expect(afterTasks).toHaveLength(1);
        expect(runMailAlertBatch).not.toHaveBeenCalled();
    });

    it('예약된 작업은 비밀·발송기·같은 시각으로 의존성을 만들어 패스를 돌린다', async () => {
        scheduleMailAlertPass({ now: NOW, dispatcher });

        await afterTasks[0]?.();

        expect(createMailAlertBatchDeps).toHaveBeenCalledWith(
            's'.repeat(40),
            dispatcher
        );
        expect(runMailAlertBatch).toHaveBeenCalledWith({ marker: 'deps' }, NOW);
    });

    it('끝난 실행은 결과 건수를 한 줄로 남긴다', async () => {
        vi.mocked(runMailAlertBatch).mockResolvedValue({
            status: 'done',
            counts: { sent: 3 } as never,
        });

        scheduleMailAlertPass({ now: NOW, dispatcher });
        await afterTasks[0]?.();

        expect(console.log).toHaveBeenCalledWith(
            '[mail-alert] run done:',
            JSON.stringify({ sent: 3 })
        );
    });

    it('시각 밖·미공개 같은 비실행 결과는 로그를 남기지 않는다', async () => {
        scheduleMailAlertPass({ now: NOW, dispatcher });
        await afterTasks[0]?.();

        expect(console.log).not.toHaveBeenCalled();
    });

    it('패스가 던져도 작업은 삼키고 실패 로그를 남긴다', async () => {
        vi.mocked(runMailAlertBatch).mockRejectedValue(new Error('boom'));

        scheduleMailAlertPass({ now: NOW, dispatcher });

        await expect(afterTasks[0]?.()).resolves.toBeUndefined();
        expect(console.error).toHaveBeenCalledWith(
            '[mail-alert] run failed:',
            expect.anything()
        );
    });
});
