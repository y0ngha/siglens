import type { MockedFunction } from 'vitest';
vi.mock('@/entities/auth', () => ({
    requestEmailVerification: vi.fn(),
}));
vi.mock('@/entities/auth', () => ({
    AUTH_SERVICE_UNAVAILABLE_MESSAGE:
        '서비스에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
}));
vi.mock('@/entities/email-token', () => ({
    createEmailTokenStore: vi.fn(),
    buildEmailVerificationEmail: vi.fn(({ to, code }) => ({
        to,
        subject: 'subj',
        html: `html-${code}`,
        text: `text-${code}`,
    })),
}));

const { sendEmailMock } = vi.hoisted(() => ({ sendEmailMock: vi.fn() }));
vi.mock('@/shared/email/dispatcher', () => ({
    createEmailDispatcher: vi.fn(() => ({ sendEmail: sendEmailMock })),
}));

import { requestEmailVerification } from '@/entities/auth';
import {
    createEmailTokenStore,
    buildEmailVerificationEmail,
} from '@/entities/email-token';
import { AUTH_SERVICE_UNAVAILABLE_MESSAGE } from '@/entities/auth';
import { requestEmailVerificationAction } from '@/features/auth-email-verification/actions/requestEmailVerificationAction';
import { makeFormData } from '@/shared/test-utils/makeFormData';

const mockRequest = requestEmailVerification as MockedFunction<
    typeof requestEmailVerification
>;
const mockCreateTokenStore = createEmailTokenStore as MockedFunction<
    typeof createEmailTokenStore
>;
const mockBuild = buildEmailVerificationEmail as MockedFunction<
    typeof buildEmailVerificationEmail
>;

describe('requestEmailVerificationAction', () => {
    beforeEach(() => {
        mockRequest.mockReset();
        sendEmailMock.mockReset();
        mockBuild.mockClear();
        mockCreateTokenStore.mockReset();
        mockCreateTokenStore.mockReturnValue({
            set: vi.fn(),
            get: vi.fn(),
            delete: vi.fn(),
            consume: vi.fn(),
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
