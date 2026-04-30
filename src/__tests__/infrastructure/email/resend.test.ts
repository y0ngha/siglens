const sendMock = jest.fn();
jest.mock('resend', () => ({
    Resend: jest.fn().mockImplementation(() => ({
        emails: { send: sendMock },
    })),
}));

import { Resend } from 'resend';
import {
    ResendEmailDispatcher,
    createEmailDispatcher,
} from '@/infrastructure/email/resend';

const ResendCtor = Resend as jest.MockedClass<typeof Resend>;

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

    it('Resend가 error를 반환하면 false를 반환한다', async () => {
        sendMock.mockResolvedValue({ data: null, error: { message: 'fail' } });
        const dispatcher = new ResendEmailDispatcher({
            apiKey: 'k',
            from: 'noreply@siglens.io',
        });
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
        await expect(dispatcher.sendEmail(message)).resolves.toBe(false);
        warnSpy.mockRestore();
    });
});

describe('createEmailDispatcher', () => {
    let originalApiKey: string | undefined;
    let originalFrom: string | undefined;

    beforeEach(() => {
        originalApiKey = process.env.RESEND_API_KEY;
        originalFrom = process.env.EMAIL_FROM;
        delete process.env.RESEND_API_KEY;
        delete process.env.EMAIL_FROM;
        ResendCtor.mockClear();
    });

    afterEach(() => {
        if (originalApiKey === undefined) delete process.env.RESEND_API_KEY;
        else process.env.RESEND_API_KEY = originalApiKey;
        if (originalFrom === undefined) delete process.env.EMAIL_FROM;
        else process.env.EMAIL_FROM = originalFrom;
    });

    it('RESEND_API_KEY가 없으면 noop dispatcher를 반환하여 항상 false', async () => {
        const dispatcher = createEmailDispatcher();
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
        const result = await dispatcher.sendEmail({
            to: 't@t.com',
            subject: 's',
            html: 'h',
            text: 't',
        });
        expect(result).toBe(false);
        expect(ResendCtor).not.toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    it('RESEND_API_KEY가 있으면 ResendEmailDispatcher를 반환한다', () => {
        process.env.RESEND_API_KEY = 'test-key';
        createEmailDispatcher();
        expect(ResendCtor).toHaveBeenCalledWith('test-key');
    });

    it('EMAIL_FROM env가 있으면 해당 주소를 from으로 사용한다', async () => {
        process.env.RESEND_API_KEY = 'test-key';
        process.env.EMAIL_FROM = 'custom@siglens.io';
        sendMock.mockResolvedValue({ data: { id: 'abc' }, error: null });
        const dispatcher = createEmailDispatcher();
        await dispatcher.sendEmail({
            to: 'u@u.com',
            subject: 's',
            html: 'h',
            text: 't',
        });
        expect(sendMock).toHaveBeenCalledWith(
            expect.objectContaining({ from: 'custom@siglens.io' })
        );
    });
});
