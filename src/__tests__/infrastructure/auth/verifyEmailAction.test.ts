const verifyEmailMock = jest.fn();
const createEmailTokenStoreMock = jest.fn(() => ({}));
jest.mock('@/domain/auth/coreStubs', () => ({
    verifyEmail: verifyEmailMock,
    createEmailTokenStore: createEmailTokenStoreMock,
}));

import { verifyEmailAction } from '@/infrastructure/auth/verifyEmailAction';
import { makeFormData } from '@/__tests__/utils/makeFormData';

describe('verifyEmailAction', () => {
    beforeEach(() => {
        verifyEmailMock.mockReset();
    });

    describe('성공', () => {
        it('코어 ok=true 시 verified: true 와 error: null 을 반환한다', async () => {
            verifyEmailMock.mockResolvedValue({ ok: true });
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
            verifyEmailMock.mockResolvedValue({ ok: true });
            await verifyEmailAction(
                { verified: false, error: null },
                makeFormData({
                    email: '  user@example.com  ',
                    code: '  482917  ',
                })
            );
            expect(verifyEmailMock).toHaveBeenCalledWith(
                { email: 'user@example.com', code: '482917' },
                expect.any(Object)
            );
        });
    });

    describe('실패', () => {
        it('invalid_code 에러를 그대로 반환한다', async () => {
            verifyEmailMock.mockResolvedValue({
                ok: false,
                error: { code: 'invalid_code', message: '잘못된 코드' },
            });
            const result = await verifyEmailAction(
                { verified: false, error: null },
                makeFormData({
                    email: 'user@example.com',
                    code: 'wrong',
                })
            );
            expect(result.verified).toBe(false);
            expect(result.error?.code).toBe('invalid_code');
        });

        it('expired_code 에러를 그대로 반환한다', async () => {
            verifyEmailMock.mockResolvedValue({
                ok: false,
                error: { code: 'expired_code', message: '만료된 코드' },
            });
            const result = await verifyEmailAction(
                { verified: false, error: null },
                makeFormData({
                    email: 'user@example.com',
                    code: '482917',
                })
            );
            expect(result.error?.code).toBe('expired_code');
        });

        it('no_pending_verification 에러를 그대로 반환한다', async () => {
            verifyEmailMock.mockResolvedValue({
                ok: false,
                error: {
                    code: 'no_pending_verification',
                    message: '대기 중인 인증 요청이 없습니다',
                },
            });
            const result = await verifyEmailAction(
                { verified: false, error: null },
                makeFormData({
                    email: 'user@example.com',
                    code: '482917',
                })
            );
            expect(result.error?.code).toBe('no_pending_verification');
        });
    });

    describe('입력 누락', () => {
        it('email/code 키가 없으면 빈 문자열로 호출한다', async () => {
            verifyEmailMock.mockResolvedValue({ ok: true });
            await verifyEmailAction(
                { verified: false, error: null },
                makeFormData({})
            );
            expect(verifyEmailMock).toHaveBeenCalledWith(
                { email: '', code: '' },
                expect.any(Object)
            );
        });
    });
});
