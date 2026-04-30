const requestEmailVerificationMock = jest.fn();
const createEmailTokenStoreMock = jest.fn(() => ({}));
jest.mock('@/domain/auth/coreStubs', () => ({
    requestEmailVerification: requestEmailVerificationMock,
    createEmailTokenStore: createEmailTokenStoreMock,
}));

const sendEmailMock = jest.fn();
jest.mock('@/infrastructure/email/resend', () => ({
    createEmailDispatcher: jest.fn(() => ({ sendEmail: sendEmailMock })),
}));

jest.mock('@/infrastructure/email/emailVerificationEmail', () => ({
    buildEmailVerificationEmail: jest.fn(({ to, code }) => ({
        to,
        subject: 'subj',
        html: `html-${code}`,
        text: `text-${code}`,
    })),
}));

import { buildEmailVerificationEmail } from '@/infrastructure/email/emailVerificationEmail';
import { requestEmailVerificationAction } from '@/infrastructure/auth/requestEmailVerificationAction';
import { makeFormData } from '@/__tests__/utils/makeFormData';

const mockBuild = buildEmailVerificationEmail as jest.MockedFunction<
    typeof buildEmailVerificationEmail
>;

describe('requestEmailVerificationAction', () => {
    beforeEach(() => {
        requestEmailVerificationMock.mockReset();
        sendEmailMock.mockReset();
        mockBuild.mockClear();
    });

    describe('성공', () => {
        it('코어 ok=true 시 submitted: true 와 error: null 을 반환한다', async () => {
            requestEmailVerificationMock.mockResolvedValue({ ok: true });
            const result = await requestEmailVerificationAction(
                { submitted: false, error: null },
                makeFormData({ email: 'user@example.com' })
            );
            expect(result.submitted).toBe(true);
            expect(result.error).toBeNull();
        });

        it('buildMessage 콜백을 호출하면 to/code가 채워진 메시지를 반환한다', async () => {
            requestEmailVerificationMock.mockResolvedValue({ ok: true });
            await requestEmailVerificationAction(
                { submitted: false, error: null },
                makeFormData({ email: 'user@example.com' })
            );
            const callArgs = requestEmailVerificationMock.mock.calls[0]!;
            const options = callArgs[2] as {
                buildMessage: (code: string) => unknown;
            };
            const message = options.buildMessage('482917') as { to: string };
            expect(mockBuild).toHaveBeenCalledWith({
                to: 'user@example.com',
                code: '482917',
            });
            expect(message.to).toBe('user@example.com');
        });
    });

    describe('실패', () => {
        it('코어 ok=false 시 폼 상태로 에러를 반환한다', async () => {
            requestEmailVerificationMock.mockResolvedValue({
                ok: false,
                error: {
                    code: 'rate_limited',
                    message: '너무 자주 요청',
                },
            });
            const result = await requestEmailVerificationAction(
                { submitted: false, error: null },
                makeFormData({ email: 'user@example.com' })
            );
            expect(result.submitted).toBe(false);
            expect(result.error?.code).toBe('rate_limited');
        });
    });

    describe('입력 정규화', () => {
        it('email은 trim 후 코어로 전달한다', async () => {
            requestEmailVerificationMock.mockResolvedValue({ ok: true });
            await requestEmailVerificationAction(
                { submitted: false, error: null },
                makeFormData({ email: '  user@example.com  ' })
            );
            expect(requestEmailVerificationMock).toHaveBeenCalledWith(
                { email: 'user@example.com' },
                expect.any(Object),
                expect.any(Object)
            );
        });
    });
});
