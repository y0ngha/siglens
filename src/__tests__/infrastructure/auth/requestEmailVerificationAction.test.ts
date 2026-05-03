jest.mock('@/infrastructure/auth/use-cases/requestEmailVerification', () => ({
    requestEmailVerification: jest.fn(),
}));
jest.mock('@/infrastructure/email/tokenStore', () => ({
    createEmailTokenStore: jest.fn(),
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

import { requestEmailVerification } from '@/infrastructure/auth/use-cases/requestEmailVerification';
import { createEmailTokenStore } from '@/infrastructure/email/tokenStore';
import { buildEmailVerificationEmail } from '@/infrastructure/email/emailVerificationEmail';
import { AUTH_SERVICE_UNAVAILABLE_MESSAGE } from '@/infrastructure/auth/errorMessages';
import { requestEmailVerificationAction } from '@/infrastructure/auth/requestEmailVerificationAction';
import { makeFormData } from '@/__tests__/utils/makeFormData';

const mockRequest = requestEmailVerification as jest.MockedFunction<
    typeof requestEmailVerification
>;
const mockCreateTokenStore = createEmailTokenStore as jest.MockedFunction<
    typeof createEmailTokenStore
>;
const mockBuild = buildEmailVerificationEmail as jest.MockedFunction<
    typeof buildEmailVerificationEmail
>;

describe('requestEmailVerificationAction', () => {
    beforeEach(() => {
        mockRequest.mockReset();
        sendEmailMock.mockReset();
        mockBuild.mockClear();
        mockCreateTokenStore.mockReset();
        mockCreateTokenStore.mockReturnValue({
            set: jest.fn(),
            get: jest.fn(),
            delete: jest.fn(),
            consume: jest.fn(),
        });
    });

    describe('Redis 미설정', () => {
        it('createEmailTokenStore가 null이면 redis_unavailable 에러를 반환한다', async () => {
            mockCreateTokenStore.mockReturnValue(null);
            const result = await requestEmailVerificationAction(
                { submitted: false, error: null },
                makeFormData({ email: 'user@example.com' })
            );
            expect(result.submitted).toBe(false);
            expect(result.error?.code).toBe('redis_unavailable');
            expect(result.error?.message).toBe(
                AUTH_SERVICE_UNAVAILABLE_MESSAGE
            );
            expect(mockRequest).not.toHaveBeenCalled();
        });
    });

    describe('코어 ok: true 시 submitted: true 반환', () => {
        it('코어 호출 후 submitted: true 와 error: null 을 반환한다', async () => {
            mockRequest.mockResolvedValue({
                ok: true,
                codeIssued: true,
                emailDispatched: true,
            });
            const result = await requestEmailVerificationAction(
                { submitted: false, error: null },
                makeFormData({ email: 'user@example.com' })
            );
            expect(result.submitted).toBe(true);
            expect(result.error).toBeNull();
        });
    });

    describe('항상 submitted: true 반환 (enumeration 회피)', () => {
        it('codeIssued: false 응답에도 submitted: true 를 반환한다', async () => {
            mockRequest.mockResolvedValue({
                ok: true,
                codeIssued: false,
                emailDispatched: false,
            });
            const result = await requestEmailVerificationAction(
                { submitted: false, error: null },
                makeFormData({ email: 'invalid' })
            );
            expect(result.submitted).toBe(true);
        });
    });

    describe('buildMessage 콜백', () => {
        it('buildMessage 콜백을 호출하면 to/code가 채워진 메시지를 반환한다', async () => {
            mockRequest.mockResolvedValue({
                ok: true,
                codeIssued: true,
                emailDispatched: true,
            });
            await requestEmailVerificationAction(
                { submitted: false, error: null },
                makeFormData({ email: 'user@example.com' })
            );
            const callArgs = mockRequest.mock.calls[0]!;
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

    describe('입력 정규화', () => {
        it('email은 trim 후 코어로 전달한다', async () => {
            mockRequest.mockResolvedValue({
                ok: true,
                codeIssued: true,
                emailDispatched: true,
            });
            await requestEmailVerificationAction(
                { submitted: false, error: null },
                makeFormData({ email: '  user@example.com  ' })
            );
            expect(mockRequest).toHaveBeenCalledWith(
                { email: 'user@example.com' },
                expect.objectContaining({
                    emailTokens: expect.objectContaining({
                        set: expect.any(Function),
                        get: expect.any(Function),
                        delete: expect.any(Function),
                    }),
                    emailDispatcher: expect.objectContaining({
                        sendEmail: expect.any(Function),
                    }),
                }),
                expect.any(Object)
            );
        });

        it('email 키가 없으면 빈 문자열로 코어를 호출한다', async () => {
            mockRequest.mockResolvedValue({
                ok: true,
                codeIssued: false,
                emailDispatched: false,
            });
            await requestEmailVerificationAction(
                { submitted: false, error: null },
                makeFormData({})
            );
            expect(mockRequest).toHaveBeenCalledWith(
                { email: '' },
                expect.objectContaining({
                    emailTokens: expect.objectContaining({
                        set: expect.any(Function),
                        get: expect.any(Function),
                        delete: expect.any(Function),
                    }),
                    emailDispatcher: expect.objectContaining({
                        sendEmail: expect.any(Function),
                    }),
                }),
                expect.any(Object)
            );
        });
    });
});
