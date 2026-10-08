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

import { GET, POST } from '@/app/api/email-report/unsubscribe/route';
import { readEmailReportSecret } from '@/entities/email-report/emailReportSecret';
import { buildUnsubscribeApiUrl } from '@/entities/email-report/lib/reportLinks';
import { SITE_URL } from '@/shared/lib/seo';

const SECRET = 'route-secret-route-secret-route-secret';
const USER = '0b6f1c2e-6a8f-4f58-9d7a-0d1b2c3d4e5f';
const mockSecret = vi.mocked(readEmailReportSecret);

describe('/api/email-report/unsubscribe', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSecret.mockReturnValue(SECRET);
        mockDisable.mockResolvedValue(true);
    });

    it('POST: 서명이 맞으면 수신을 끄고 200', async () => {
        const res = await POST(
            new Request(
                buildUnsubscribeApiUrl('http://internal:3000', SECRET, USER),
                {
                    method: 'POST',
                    body: 'List-Unsubscribe=One-Click',
                }
            )
        );

        expect(res.status).toBe(200);
        expect(mockDisable).toHaveBeenCalledWith(USER);
    });

    it('POST: 서명이 틀리면 403이고 끄지 않는다', async () => {
        const res = await POST(
            new Request(
                `http://internal:3000/api/email-report/unsubscribe?u=${USER}&sig=bad`,
                { method: 'POST' }
            )
        );

        expect(res.status).toBe(403);
        expect(mockDisable).not.toHaveBeenCalled();
    });

    it('POST: 저장 실패는 503', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mockDisable.mockRejectedValue(new Error('db down'));

        const res = await POST(
            new Request(
                buildUnsubscribeApiUrl('http://internal:3000', SECRET, USER),
                {
                    method: 'POST',
                }
            )
        );

        expect(res.status).toBe(503);
    });

    it('GET: 끄지 않고 공개 사이트의 확인 페이지로 쿼리를 그대로 넘겨 보낸다', () => {
        const res = GET(
            new Request(
                `http://internal:3000/api/email-report/unsubscribe?u=${USER}&sig=abc`
            )
        );

        expect(res.status).toBe(303);
        expect(res.headers.get('location')).toBe(
            `${SITE_URL}/email-report/unsubscribe?u=${USER}&sig=abc`
        );
        expect(mockDisable).not.toHaveBeenCalled();
    });
});
