jest.mock('@y0ngha/siglens-core', () => ({
    DrizzleUserRepository: jest.fn().mockImplementation(() => ({})),
    createDatabaseClient: jest.fn(() => ({ db: {}, sql: () => null })),
}));

const requestPasswordResetV2Mock = jest.fn();
const createEmailTokenStoreMock = jest.fn(() => ({}));
jest.mock('@/domain/auth/coreStubs', () => ({
    requestPasswordResetV2: requestPasswordResetV2Mock,
    createEmailTokenStore: createEmailTokenStoreMock,
}));

const sendEmailMock = jest.fn();
jest.mock('@/infrastructure/email/resend', () => ({
    createEmailDispatcher: jest.fn(() => ({ sendEmail: sendEmailMock })),
}));

jest.mock('@/infrastructure/email/passwordResetEmail', () => ({
    buildPasswordResetEmail: jest.fn(({ to, email, token }) => ({
        to,
        subject: 'subject',
        html: `html-${email}-${token}`,
        text: `text-${email}-${token}`,
    })),
}));

import { buildPasswordResetEmail } from '@/infrastructure/email/passwordResetEmail';
import { requestPasswordResetAction } from '@/infrastructure/auth/requestPasswordResetAction';
import { resetAuthDatabaseClientForTests } from '@/infrastructure/auth/db';
import { makeFormData } from '@/__tests__/utils/makeFormData';

const mockBuild = buildPasswordResetEmail as jest.MockedFunction<
    typeof buildPasswordResetEmail
>;

describe('requestPasswordResetAction', () => {
    beforeEach(() => {
        resetAuthDatabaseClientForTests();
        process.env.DATABASE_URL = 'postgres://test';
        requestPasswordResetV2Mock.mockReset();
        sendEmailMock.mockReset();
        mockBuild.mockClear();
    });

    describe('항상 submitted: true 를 반환 (enumeration 회피)', () => {
        it('코어가 ok=false라도 submitted: true 를 반환한다', async () => {
            requestPasswordResetV2Mock.mockResolvedValue({
                ok: false,
                error: { code: 'unknown', message: 'whatever' },
            });
            const result = await requestPasswordResetAction(
                { submitted: false },
                makeFormData({ email: 'user@example.com' })
            );
            expect(result.submitted).toBe(true);
        });

        it('코어가 ok=true이면 submitted: true 를 반환한다', async () => {
            requestPasswordResetV2Mock.mockResolvedValue({ ok: true });
            const result = await requestPasswordResetAction(
                { submitted: false },
                makeFormData({ email: 'user@example.com' })
            );
            expect(result.submitted).toBe(true);
        });
    });

    describe('buildMessage 콜백', () => {
        it('코어에 buildMessage 콜백을 전달하며, 호출 시 to/email/token이 모두 채워진 메시지를 반환한다', async () => {
            requestPasswordResetV2Mock.mockResolvedValue({ ok: true });
            await requestPasswordResetAction(
                { submitted: false },
                makeFormData({ email: 'user@example.com' })
            );
            const callArgs = requestPasswordResetV2Mock.mock.calls[0]!;
            const options = callArgs[2] as {
                buildMessage: (token: string) => unknown;
            };
            const message = options.buildMessage('the-token') as {
                to: string;
                html: string;
            };
            expect(mockBuild).toHaveBeenCalledWith({
                to: 'user@example.com',
                email: 'user@example.com',
                token: 'the-token',
            });
            expect(message.to).toBe('user@example.com');
            expect(message.html).toContain('the-token');
        });
    });

    describe('입력 정규화', () => {
        it('email은 trim 후 코어로 전달한다', async () => {
            requestPasswordResetV2Mock.mockResolvedValue({ ok: true });
            await requestPasswordResetAction(
                { submitted: false },
                makeFormData({ email: '  user@example.com  ' })
            );
            expect(requestPasswordResetV2Mock).toHaveBeenCalledWith(
                { email: 'user@example.com' },
                expect.any(Object),
                expect.any(Object)
            );
        });

        it('email 키가 없으면 빈 문자열로 코어를 호출한다', async () => {
            requestPasswordResetV2Mock.mockResolvedValue({ ok: true });
            await requestPasswordResetAction(
                { submitted: false },
                makeFormData({})
            );
            expect(requestPasswordResetV2Mock).toHaveBeenCalledWith(
                { email: '' },
                expect.any(Object),
                expect.any(Object)
            );
        });
    });
});
