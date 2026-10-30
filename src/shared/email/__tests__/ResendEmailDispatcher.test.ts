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
