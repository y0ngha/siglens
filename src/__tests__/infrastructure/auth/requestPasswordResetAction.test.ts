jest.mock('@y0ngha/siglens-core', () => ({
    DrizzleUserRepository: jest.fn().mockImplementation(() => ({})),
    requestPasswordReset: jest.fn(),
    createDatabaseClient: jest.fn(() => ({ db: {}, sql: () => null })),
}));

jest.mock('@vercel/functions', () => ({
    waitUntil: jest.fn(),
}));

const sendEmailMock = jest.fn();
jest.mock('@/infrastructure/email/resend', () => ({
    createEmailDispatcher: jest.fn(() => ({ sendEmail: sendEmailMock })),
}));

jest.mock('@/infrastructure/email/passwordResetEmail', () => ({
    buildPasswordResetEmail: jest.fn(({ to, token }) => ({
        to,
        subject: 'subject',
        html: `html-${token}`,
        text: `text-${token}`,
    })),
}));

import { waitUntil } from '@vercel/functions';
import { requestPasswordReset } from '@y0ngha/siglens-core';
import { buildPasswordResetEmail } from '@/infrastructure/email/passwordResetEmail';
import { requestPasswordResetAction } from '@/infrastructure/auth/requestPasswordResetAction';
import { resetAuthDatabaseClientForTests } from '@/infrastructure/auth/db';
import { makeFormData } from '@/__tests__/utils/makeFormData';

const mockRequest = requestPasswordReset as jest.MockedFunction<
    typeof requestPasswordReset
>;
const mockBuild = buildPasswordResetEmail as jest.MockedFunction<
    typeof buildPasswordResetEmail
>;
const mockWaitUntil = waitUntil as jest.MockedFunction<typeof waitUntil>;

describe('requestPasswordResetAction', () => {
    beforeEach(() => {
        resetAuthDatabaseClientForTests();
        process.env.DATABASE_URL = 'postgres://test';
        mockRequest.mockReset();
        sendEmailMock.mockReset();
        mockBuild.mockClear();
        mockWaitUntil.mockClear();
    });

    describe('항상 submitted: true 를 반환 (enumeration 회피)', () => {
        it('등록되지 않은 이메일이어도 submitted: true 를 반환한다', async () => {
            mockRequest.mockResolvedValue({
                ok: true,
                token: null,
                expiresAt: null,
            });
            const result = await requestPasswordResetAction(
                { submitted: false },
                makeFormData({ email: 'unknown@example.com' })
            );
            expect(result.submitted).toBe(true);
            expect(sendEmailMock).not.toHaveBeenCalled();
        });

        it('등록된 이메일이면 submitted: true 를 반환하고 메일 발송을 waitUntil에 등록한다', async () => {
            mockRequest.mockResolvedValue({
                ok: true,
                token: 'tok-1',
                expiresAt: new Date('2026-05-01T00:00:00Z'),
            });
            sendEmailMock.mockResolvedValue(true);
            const result = await requestPasswordResetAction(
                { submitted: false },
                makeFormData({ email: 'user@example.com' })
            );
            expect(result.submitted).toBe(true);
            expect(mockBuild).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: 'user@example.com',
                    token: 'tok-1',
                    siteUrl: 'https://siglens.io',
                    siteName: 'Siglens',
                })
            );
            expect(sendEmailMock).toHaveBeenCalledWith(
                expect.objectContaining({ to: 'user@example.com' }),
                expect.objectContaining({ signal: expect.any(AbortSignal) })
            );
            expect(mockWaitUntil).toHaveBeenCalledWith(expect.any(Promise));
        });
    });

    describe('입력 정규화', () => {
        it('email은 trim 후 코어로 전달한다', async () => {
            mockRequest.mockResolvedValue({
                ok: true,
                token: null,
                expiresAt: null,
            });
            await requestPasswordResetAction(
                { submitted: false },
                makeFormData({ email: '  user@example.com  ' })
            );
            expect(mockRequest).toHaveBeenCalledWith(
                { email: 'user@example.com' },
                expect.any(Object)
            );
        });

        it('email 키가 없으면 빈 문자열로 코어를 호출한다', async () => {
            mockRequest.mockResolvedValue({
                ok: true,
                token: null,
                expiresAt: null,
            });
            await requestPasswordResetAction(
                { submitted: false },
                makeFormData({})
            );
            expect(mockRequest).toHaveBeenCalledWith(
                { email: '' },
                expect.any(Object)
            );
        });
    });
});
