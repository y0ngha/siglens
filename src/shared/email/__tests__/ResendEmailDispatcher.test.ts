const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));
vi.mock('resend', () => ({
    Resend: vi.fn().mockImplementation(function () {
        return { emails: { send: sendMock } };
    }),
}));

import { Resend } from 'resend';
import type { MockedClass } from 'vitest';
import { ResendEmailDispatcher } from '../ResendEmailDispatcher';

const ResendCtor = Resend as MockedClass<typeof Resend>;

describe('ResendEmailDispatcher', () => {
    const message = {
        to: 'user@example.com',
        subject: 's',
        html: '<p>h</p>',
        text: 't',
    };

    beforeEach(() => {
        sendMock.mockReset();
        ResendCtor.mockClear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('성공 응답 시 true를 반환한다', async () => {
        sendMock.mockResolvedValue({ data: { id: 'abc' }, error: null });
        const dispatcher = new ResendEmailDispatcher({
            apiKey: 'k',
            from: 'noreply@siglens.io',
        });
        await expect(dispatcher.sendEmail(message)).resolves.toBe(true);
        expect(sendMock).toHaveBeenCalledWith({
            from: 'noreply@siglens.io',
            to: 'user@example.com',
            subject: 's',
            html: '<p>h</p>',
            text: 't',
        });
    });

    it('headers가 있으면 Resend에 그대로 넘긴다', async () => {
        sendMock.mockResolvedValue({ data: { id: 'abc' }, error: null });
        const dispatcher = new ResendEmailDispatcher({
            apiKey: 'k',
            from: 'noreply@siglens.io',
        });

        await dispatcher.sendEmail({
            to: 'user@example.com',
            subject: 's',
            html: '<p>h</p>',
            text: 't',
            headers: { 'List-Unsubscribe': '<https://siglens.io/u>' },
        });

        expect(sendMock).toHaveBeenCalledWith(
            expect.objectContaining({
                headers: { 'List-Unsubscribe': '<https://siglens.io/u>' },
            })
        );
    });

    it('멱등 키가 있으면 Resend 두 번째 인자로 넘긴다', async () => {
        sendMock.mockResolvedValue({ data: { id: 'abc' }, error: null });
        const dispatcher = new ResendEmailDispatcher({
            apiKey: 'k',
            from: 'noreply@siglens.io',
        });

        await dispatcher.sendEmail({
            ...message,
            idempotencyKey: 'email-report-welcome/u-1',
        });

        expect(sendMock).toHaveBeenCalledWith(
            expect.objectContaining({ to: 'user@example.com' }),
            { idempotencyKey: 'email-report-welcome/u-1' }
        );
    });

    it('멱등 키가 없으면 두 번째 인자를 넘기지 않는다', async () => {
        sendMock.mockResolvedValue({ data: { id: 'abc' }, error: null });
        const dispatcher = new ResendEmailDispatcher({
            apiKey: 'k',
            from: 'noreply@siglens.io',
        });

        await dispatcher.sendEmail(message);

        expect(sendMock.mock.lastCall).toHaveLength(1);
    });

    describe('sendKeyedEmail', () => {
        const keyed = {
            ...message,
            idempotencyKey: 'email-report-welcome/u-1',
        };
        const dispatcher = () =>
            new ResendEmailDispatcher({
                apiKey: 'k',
                from: 'noreply@siglens.io',
            });

        it('수락되면 accepted이고 키를 Resend 두 번째 인자로 넘긴다', async () => {
            sendMock.mockResolvedValue({ data: { id: 'abc' }, error: null });

            await expect(dispatcher().sendKeyedEmail(keyed)).resolves.toBe(
                'accepted'
            );
            expect(sendMock.mock.lastCall?.[1]).toEqual({
                idempotencyKey: 'email-report-welcome/u-1',
            });
        });

        it('invalid_idempotent_request는 첫 요청이 이미 수락된 것이라 already_accepted다', async () => {
            sendMock.mockResolvedValue({
                data: null,
                error: { name: 'invalid_idempotent_request', message: 'x' },
            });

            await expect(dispatcher().sendKeyedEmail(keyed)).resolves.toBe(
                'already_accepted'
            );
        });

        it('concurrent_idempotent_requests는 처리 중이라 in_flight다', async () => {
            sendMock.mockResolvedValue({
                data: null,
                error: { name: 'concurrent_idempotent_requests', message: 'x' },
            });

            await expect(dispatcher().sendKeyedEmail(keyed)).resolves.toBe(
                'in_flight'
            );
        });

        it('그 밖의 오류와 SDK 예외는 rejected다', async () => {
            sendMock.mockResolvedValueOnce({
                data: null,
                error: { name: 'rate_limit_exceeded', message: 'x' },
            });
            await expect(dispatcher().sendKeyedEmail(keyed)).resolves.toBe(
                'rejected'
            );

            sendMock.mockRejectedValueOnce(new Error('network error'));
            await expect(dispatcher().sendKeyedEmail(keyed)).resolves.toBe(
                'rejected'
            );
        });

        it('같은 두 오류도 키 없는 sendEmail에서는 그냥 false다', async () => {
            sendMock.mockResolvedValue({
                data: null,
                error: { name: 'invalid_idempotent_request', message: 'x' },
            });

            await expect(dispatcher().sendEmail(message)).resolves.toBe(false);
        });
    });

    it('replyTo가 있으면 Resend replyTo 필드로 넘긴다', async () => {
        sendMock.mockResolvedValue({ data: { id: 'abc' }, error: null });
        const dispatcher = new ResendEmailDispatcher({
            apiKey: 'k',
            from: 'noreply@siglens.io',
        });

        await dispatcher.sendEmail({ ...message, replyTo: 'v@example.com' });

        expect(sendMock).toHaveBeenCalledWith(
            expect.objectContaining({ replyTo: 'v@example.com' })
        );
    });

    it('replyTo가 없으면 키를 싣지 않는다', async () => {
        sendMock.mockResolvedValue({ data: { id: 'abc' }, error: null });
        const dispatcher = new ResendEmailDispatcher({
            apiKey: 'k',
            from: 'noreply@siglens.io',
        });

        await dispatcher.sendEmail(message);

        expect(sendMock.mock.lastCall?.[0]).not.toHaveProperty('replyTo');
    });

    it('Resend가 error를 반환하면 false를 반환한다', async () => {
        sendMock.mockResolvedValue({ data: null, error: { message: 'fail' } });
        const dispatcher = new ResendEmailDispatcher({
            apiKey: 'k',
            from: 'noreply@siglens.io',
        });
        await expect(dispatcher.sendEmail(message)).resolves.toBe(false);
    });

    it('Resend SDK가 reject하면 false를 반환한다', async () => {
        sendMock.mockRejectedValue(new Error('network error'));
        const dispatcher = new ResendEmailDispatcher({
            apiKey: 'k',
            from: 'noreply@siglens.io',
        });
        await expect(dispatcher.sendEmail(message)).resolves.toBe(false);
    });

    it('이메일 발송이 타임아웃되면 false를 반환한다', async () => {
        sendMock.mockReturnValue(new Promise(() => {}));
        vi.spyOn(AbortSignal, 'timeout').mockReturnValueOnce(
            AbortSignal.abort(new DOMException('timeout', 'TimeoutError'))
        );
        const dispatcher = new ResendEmailDispatcher({
            apiKey: 'k',
            from: 'noreply@siglens.io',
        });
        await expect(dispatcher.sendEmail(message)).resolves.toBe(false);
    });
});
