const { mockDisable } = vi.hoisted(() => ({ mockDisable: vi.fn() }));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {} })),
}));
vi.mock('@/entities/email-report/api', () => ({
    DrizzleEmailReportSubscriptionRepository: vi
        .fn()
        .mockImplementation(function () {
            return { disable: mockDisable };
        }),
}));
vi.mock('@/entities/email-report/emailReportSecret', () => ({
    readEmailReportSecret: vi.fn(),
}));

import { unsubscribeEmailReportAction } from '@/entities/email-report/actions/unsubscribeEmailReportAction';
import { readEmailReportSecret } from '@/entities/email-report/emailReportSecret';
import { signReportValue } from '@/entities/email-report/lib/reportSignature';

const SECRET = 'action-secret-action-secret-action-secret';
const USER = '0b6f1c2e-6a8f-4f58-9d7a-0d1b2c3d4e5f';

describe('unsubscribeEmailReportAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(readEmailReportSecret).mockReturnValue(SECRET);
        mockDisable.mockResolvedValue(true);
    });

    it('서명이 맞으면 수신을 끄고 ok — 로그인 없이 동작한다', async () => {
        const result = await unsubscribeEmailReportAction({
            userId: USER,
            signature: signReportValue(SECRET, 'unsubscribe', USER),
        });

        expect(result).toEqual({ status: 'ok' });
        expect(mockDisable).toHaveBeenCalledWith(USER);
    });

    it('서명이 틀리면 invalid_link 오류 문구를 돌려준다', async () => {
        const result = await unsubscribeEmailReportAction({
            userId: USER,
            signature: 'bad',
        });

        expect(result).toMatchObject({
            status: 'error',
            code: 'invalid_link',
            message:
                '수신거부 링크가 올바르지 않아요. 메일의 링크를 다시 눌러 주세요.',
        });
    });

    it('모양이 틀린 입력도 던지지 않고 invalid_link다', async () => {
        const result = await unsubscribeEmailReportAction(null as never);

        expect(result).toMatchObject({ status: 'error', code: 'invalid_link' });
        expect(mockDisable).not.toHaveBeenCalled();
    });

    it('저장 실패는 storage_unavailable로 돌려준다', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mockDisable.mockRejectedValue(new Error('db down'));

        const result = await unsubscribeEmailReportAction({
            userId: USER,
            signature: signReportValue(SECRET, 'unsubscribe', USER),
        });

        expect(result).toMatchObject({
            status: 'error',
            code: 'storage_unavailable',
        });
    });
});
