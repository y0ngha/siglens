jest.mock('@y0ngha/siglens-core', () => ({
    createEmailTokenStore: jest.fn(),
    verifyEmail: jest.fn(),
}));

import { createEmailTokenStore, verifyEmail } from '@y0ngha/siglens-core';
import { AUTH_SERVICE_UNAVAILABLE_MESSAGE } from '@/infrastructure/auth/errorMessages';
import { verifyEmailAction } from '@/infrastructure/auth/verifyEmailAction';
import { makeFormData } from '@/__tests__/utils/makeFormData';

const mockVerify = verifyEmail as jest.MockedFunction<typeof verifyEmail>;
const mockCreateTokenStore = createEmailTokenStore as jest.MockedFunction<
    typeof createEmailTokenStore
>;

describe('verifyEmailAction', () => {
    beforeEach(() => {
        mockVerify.mockReset();
        mockCreateTokenStore.mockReset();
        mockCreateTokenStore.mockReturnValue({
            set: jest.fn(),
            get: jest.fn(),
            delete: jest.fn(),
        });
    });

    describe('Redis 미설정', () => {
        it('createEmailTokenStore가 null이면 invalid_verification_code 에러를 반환한다', async () => {
            mockCreateTokenStore.mockReturnValue(null);
            const result = await verifyEmailAction(
                { verified: false, error: null },
                makeFormData({
                    email: 'user@example.com',
                    code: '482917',
                })
            );
            expect(result.verified).toBe(false);
            expect(result.error?.code).toBe('invalid_verification_code');
            expect(result.error?.message).toBe(
                AUTH_SERVICE_UNAVAILABLE_MESSAGE
            );
            expect(mockVerify).not.toHaveBeenCalled();
        });
    });

    describe('성공', () => {
        it('코어 ok=true 시 verified: true 와 error: null 을 반환한다', async () => {
            mockVerify.mockResolvedValue({ ok: true });
            const result = await verifyEmailAction(
                { verified: false, error: null },
                makeFormData({
                    email: 'user@example.com',
                    code: '482917',
                })
            );
            expect(result.verified).toBe(true);
            expect(result.error).toBeNull();
        });

        it('email/code 모두 trim하여 코어를 호출한다', async () => {
            mockVerify.mockResolvedValue({ ok: true });
            await verifyEmailAction(
                { verified: false, error: null },
                makeFormData({
                    email: '  user@example.com  ',
                    code: '  482917  ',
                })
            );
            expect(mockVerify).toHaveBeenCalledWith(
                { email: 'user@example.com', code: '482917' },
                expect.any(Object)
            );
        });
    });

    describe('실패', () => {
        it('invalid_verification_code 에러를 그대로 반환한다', async () => {
            mockVerify.mockResolvedValue({
                ok: false,
                error: {
                    code: 'invalid_verification_code',
                    field: 'code',
                    message: '잘못된 코드',
                },
            });
            const result = await verifyEmailAction(
                { verified: false, error: null },
                makeFormData({
                    email: 'user@example.com',
                    code: 'wrong',
                })
            );
            expect(result.verified).toBe(false);
            expect(result.error?.code).toBe('invalid_verification_code');
        });

        it('expired_verification_code 에러를 그대로 반환한다', async () => {
            mockVerify.mockResolvedValue({
                ok: false,
                error: {
                    code: 'expired_verification_code',
                    field: 'code',
                    message: '만료된 코드',
                },
            });
            const result = await verifyEmailAction(
                { verified: false, error: null },
                makeFormData({
                    email: 'user@example.com',
                    code: '482917',
                })
            );
            expect(result.error?.code).toBe('expired_verification_code');
        });
    });

    describe('입력 누락', () => {
        it('email/code 키가 없으면 빈 문자열로 호출한다', async () => {
            mockVerify.mockResolvedValue({ ok: true });
            await verifyEmailAction(
                { verified: false, error: null },
                makeFormData({})
            );
            expect(mockVerify).toHaveBeenCalledWith(
                { email: '', code: '' },
                expect.any(Object)
            );
        });
    });
});
