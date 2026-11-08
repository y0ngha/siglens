const { sendEmailMock, scheduled } = vi.hoisted(() => ({
    sendEmailMock: vi.fn(),
    scheduled: [] as (() => Promise<void>)[],
}));
vi.mock('@/shared/lib/afterWithDrain', () => ({
    afterWithDrain: (task: () => Promise<void>) => {
        scheduled.push(task);
    },
}));
vi.mock('../dispatcher', () => ({
    createEmailDispatcher: () => ({ sendEmail: sendEmailMock }),
}));

import {
    notifyOperator,
    scheduleOperatorNotification,
} from '../operatorNotifier';

const message = { subject: 's', html: '<p>h</p>', text: 't' };

describe('notifyOperator', () => {
    beforeEach(() => {
        sendEmailMock.mockReset();
        sendEmailMock.mockResolvedValue(true);
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('OPERATOR_EMAIL이 없으면 보내지 않고 false를 반환한다', async () => {
        vi.stubEnv('OPERATOR_EMAIL', '');

        await expect(notifyOperator(message)).resolves.toBe(false);
        expect(sendEmailMock).not.toHaveBeenCalled();
    });

    it('공백뿐인 OPERATOR_EMAIL도 미설정으로 취급한다', async () => {
        vi.stubEnv('OPERATOR_EMAIL', '   ');

        await expect(notifyOperator(message)).resolves.toBe(false);
        expect(sendEmailMock).not.toHaveBeenCalled();
    });

    it('OPERATOR_EMAIL로 to를 채워 보내고 결과를 그대로 돌려준다', async () => {
        vi.stubEnv('OPERATOR_EMAIL', ' ops@example.com ');

        await expect(
            notifyOperator({ ...message, replyTo: 'v@example.com' })
        ).resolves.toBe(true);
        expect(sendEmailMock).toHaveBeenCalledWith({
            ...message,
            replyTo: 'v@example.com',
            to: 'ops@example.com',
        });
    });

    it('dispatcher가 거절하면 false를 반환한다', async () => {
        vi.stubEnv('OPERATOR_EMAIL', 'ops@example.com');
        sendEmailMock.mockResolvedValue(false);

        await expect(notifyOperator(message)).resolves.toBe(false);
    });
});

describe('scheduleOperatorNotification', () => {
    beforeEach(() => {
        sendEmailMock.mockReset();
        scheduled.length = 0;
        vi.stubEnv('OPERATOR_EMAIL', 'ops@example.com');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('호출 시점에는 보내지 않고 응답 뒤 작업으로 예약한다', async () => {
        sendEmailMock.mockResolvedValue(true);

        scheduleOperatorNotification(message, '[tag]');
        expect(sendEmailMock).not.toHaveBeenCalled();

        await scheduled[0]?.();
        expect(sendEmailMock).toHaveBeenCalledWith({
            ...message,
            to: 'ops@example.com',
        });
    });

    it('발송이 던지면 로그만 남기고 삼킨다', async () => {
        sendEmailMock.mockRejectedValue(new Error('resend down'));
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        scheduleOperatorNotification(message, '[tag]');
        await expect(scheduled[0]?.()).resolves.toBeUndefined();
        expect(errorSpy).toHaveBeenCalledWith(
            '[tag] operator notification failed',
            { name: 'Error', code: undefined }
        );
        errorSpy.mockRestore();
    });
});
