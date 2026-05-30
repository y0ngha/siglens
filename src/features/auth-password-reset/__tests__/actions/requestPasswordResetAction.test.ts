import type { MockedFunction } from 'vitest';
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
    resetDatabaseClientForTests: vi.fn(),
}));
// getAuthDatabaseClient는 barrel이 아닌 @/entities/session/lib/db에서 직접 import되므로
// (server-only 체인을 client 번들에서 분리) 해당 경로를 별도로 mock한다.
vi.mock('@/entities/session/lib/db', () => ({
    getAuthDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
    resetAuthDatabaseClientForTests: vi.fn(),
}));
vi.mock('@/entities/user', () => ({
    DrizzleUserRepository: vi.fn().mockImplementation(function () {
        return {};
    }),
    requestPasswordReset: vi.fn(),
}));
vi.mock('@/entities/email-token', () => ({
    createEmailTokenStore: vi.fn(),
    buildPasswordResetEmail: vi.fn(({ email, token }) => ({
        to: email,
        subject: 'subject',
        html: `html-${email}-${token}`,
        text: `text-${email}-${token}`,
    })),
}));

const { sendEmailMock } = vi.hoisted(() => ({ sendEmailMock: vi.fn() }));
vi.mock('@/shared/email/dispatcher', () => ({
    createEmailDispatcher: vi.fn(() => ({ sendEmail: sendEmailMock })),
}));

import { requestPasswordReset } from '@/entities/user';
import {
    createEmailTokenStore,
    buildPasswordResetEmail,
} from '@/entities/email-token';
import { requestPasswordResetAction } from '@/features/auth-password-reset/actions/requestPasswordResetAction';
import { resetAuthDatabaseClientForTests } from '@/entities/session/lib/db';
import { makeFormData } from '@/shared/test-utils/makeFormData';

const mockRequest = requestPasswordReset as MockedFunction<
    typeof requestPasswordReset
>;
const mockCreateTokenStore = createEmailTokenStore as MockedFunction<
    typeof createEmailTokenStore
>;
const mockBuild = buildPasswordResetEmail as MockedFunction<
    typeof buildPasswordResetEmail
>;

describe('requestPasswordResetAction', () => {
    beforeEach(() => {
        resetAuthDatabaseClientForTests();
        process.env.DATABASE_URL = 'postgres://test';
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
        it('createEmailTokenStore가 null이면 즉시 submitted: true를 반환한다', async () => {
            mockCreateTokenStore.mockReturnValue(null);
            const result = await requestPasswordResetAction(
                { submitted: false },
                makeFormData({ email: 'user@example.com' })
            );
            expect(result.submitted).toBe(true);
            expect(mockRequest).not.toHaveBeenCalled();
        });
    });

    describe('항상 submitted: true 를 반환 (enumeration 회피)', () => {
        it('코어 호출 후 submitted: true 를 반환한다', async () => {
            mockRequest.mockResolvedValue({
                ok: true,
                tokenIssued: true,
                emailDispatched: true,
            });
            const result = await requestPasswordResetAction(
                { submitted: false },
                makeFormData({ email: 'user@example.com' })
            );
            expect(result.submitted).toBe(true);
        });
    });

    describe('buildMessage 콜백', () => {
        it('코어에 buildMessage 콜백을 전달하며, 호출 시 email/token이 채워진 메시지를 반환한다', async () => {
            mockRequest.mockResolvedValue({
                ok: true,
                tokenIssued: true,
                emailDispatched: true,
            });
            await requestPasswordResetAction(
                { submitted: false },
                makeFormData({ email: 'user@example.com' })
            );
            const callArgs = mockRequest.mock.calls[0]!;
            const options = callArgs[2] as {
                buildMessage: (token: string) => unknown;
            };
            const message = options.buildMessage('the-token') as {
                to: string;
                html: string;
            };
            expect(mockBuild).toHaveBeenCalledWith({
                email: 'user@example.com',
                token: 'the-token',
            });
            expect(message.to).toBe('user@example.com');
            expect(message.html).toContain('the-token');
        });
    });

    describe('입력 정규화', () => {
        it('email은 trim 후 코어로 전달한다', async () => {
            mockRequest.mockResolvedValue({
                ok: true,
                tokenIssued: true,
                emailDispatched: true,
            });
            await requestPasswordResetAction(
                { submitted: false },
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
                tokenIssued: false,
                emailDispatched: false,
            });
            await requestPasswordResetAction(
                { submitted: false },
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
