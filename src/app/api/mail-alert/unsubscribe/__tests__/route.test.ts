const mocks = vi.hoisted(() => ({
    db: { marker: 'db' },
    deleteByOwner: vi.fn(),
    secret: vi.fn(),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: mocks.db })),
}));
vi.mock('@/entities/email-report/emailReportSecret', () => ({
    readEmailReportSecret: mocks.secret,
}));
vi.mock('@/entities/mail-alert/api', () => ({
    DrizzleMailAlertSubscriberRepository: vi
        .fn()
        .mockImplementation(function () {
            return { deleteByOwner: mocks.deleteByOwner };
        }),
}));
vi.mock('server-only', () => ({}));

import { GET, POST } from '@/app/api/mail-alert/unsubscribe/route';
import { buildMailAlertUnsubscribeApiUrl } from '@/entities/mail-alert/lib/mailAlertLinks';
import { SITE_URL } from '@/shared/lib/seo';

const SECRET = 'route-secret-route-secret-route-secret';
const ID = '3f0c8e3e-6b9a-4e4d-9d3a-1a2b3c4d5e6f';

function validUrl(): string {
    return buildMailAlertUnsubscribeApiUrl(SITE_URL, SECRET, ID, 'ko');
}

describe('POST /api/mail-alert/unsubscribe', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.secret.mockReturnValue(SECRET);
        mocks.deleteByOwner.mockResolvedValue(true);
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('서명이 맞으면 200이고 링크 소유자로 구독자 행을 지운다', async () => {
        const res = await POST(new Request(validUrl(), { method: 'POST' }));

        expect(res.status).toBe(200);
        expect(mocks.deleteByOwner).toHaveBeenCalledWith({
            kind: 'link',
            subscriberId: ID,
        });
    });

    it('서명이 틀리면 403이고 아무것도 지우지 않는다', async () => {
        const url = new URL(validUrl());
        url.searchParams.set('sig', 'forged');

        const res = await POST(new Request(url, { method: 'POST' }));

        expect(res.status).toBe(403);
        expect(mocks.deleteByOwner).not.toHaveBeenCalled();
    });

    it('쿼리가 없으면 403이다', async () => {
        const res = await POST(
            new Request(`${SITE_URL}/api/mail-alert/unsubscribe`, {
                method: 'POST',
            })
        );

        expect(res.status).toBe(403);
    });

    it('비밀이 없으면 403이다', async () => {
        mocks.secret.mockReturnValue(null);

        const res = await POST(new Request(validUrl(), { method: 'POST' }));

        expect(res.status).toBe(403);
        expect(mocks.deleteByOwner).not.toHaveBeenCalled();
    });

    it('테이블이 없는 환경은 403이다(지울 것도 유효한 서명도 없다)', async () => {
        mocks.deleteByOwner.mockRejectedValue(
            new Error('Failed query', { cause: { code: '42P01' } })
        );

        const res = await POST(new Request(validUrl(), { method: 'POST' }));

        expect(res.status).toBe(403);
    });

    it('DB 오류는 503이고 캐시하지 않는다', async () => {
        mocks.deleteByOwner.mockRejectedValue(new Error('connection reset'));

        const res = await POST(new Request(validUrl(), { method: 'POST' }));

        expect(res.status).toBe(503);
        expect(res.headers.get('cache-control')).toBe('no-store');
        expect(console.error).toHaveBeenCalledWith(
            '[mail-alert] one-click unsubscribe failed',
            expect.anything()
        );
    });
});

describe('GET /api/mail-alert/unsubscribe', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.secret.mockReturnValue(SECRET);
    });

    it('서명이 맞으면 지우지 않고 설정 페이지의 수신거부 구역으로 303이다', () => {
        const res = GET(new Request(validUrl()));
        const location = new URL(res.headers.get('location') ?? '');

        expect(res.status).toBe(303);
        expect(mocks.deleteByOwner).not.toHaveBeenCalled();
        expect(location.origin).toBe(new URL(SITE_URL).origin);
        expect(location.pathname).toBe('/email-report/alerts');
        expect(location.searchParams.get('s')).toBe(ID);
        expect(location.hash).toBe('#unsubscribe');
    });

    it('메일이 실은 로케일(l)로 설정 페이지를 연다', () => {
        const url = new URL(
            buildMailAlertUnsubscribeApiUrl(SITE_URL, SECRET, ID, 'en')
        );

        const res = GET(new Request(url));
        const location = new URL(res.headers.get('location') ?? '');

        expect(location.pathname).toBe('/en/email-report/alerts');
        expect(location.searchParams.get('s')).toBe(ID);
        expect(location.hash).toBe('#unsubscribe');
    });

    it('모르는 로케일 값이면 기본 언어로 연다', () => {
        const url = new URL(validUrl());
        url.searchParams.set('l', 'xx');

        const res = GET(new Request(url));

        expect(new URL(res.headers.get('location') ?? '').pathname).toBe(
            '/email-report/alerts'
        );
    });

    it('서명이 틀려도 로케일은 따른다(링크 없는 설정 페이지)', () => {
        const url = new URL(
            buildMailAlertUnsubscribeApiUrl(SITE_URL, SECRET, ID, 'en')
        );
        url.searchParams.set('sig', 'forged');

        const res = GET(new Request(url));
        const location = new URL(res.headers.get('location') ?? '');

        expect(location.pathname).toBe('/en/email-report/alerts');
        expect(location.search).toBe('');
    });

    it('옮겨 가는 링크는 수신거부 서명이 아니라 설정 서명을 싣는다', () => {
        const res = GET(new Request(validUrl()));
        const location = new URL(res.headers.get('location') ?? '');
        const original = new URL(validUrl());

        expect(location.searchParams.get('sig')).not.toBe(
            original.searchParams.get('sig')
        );
    });

    it('서명이 틀리면 링크 없는 설정 페이지로 보낸다', () => {
        const url = new URL(validUrl());
        url.searchParams.set('sig', 'forged');

        const res = GET(new Request(url));
        const location = new URL(res.headers.get('location') ?? '');

        expect(res.status).toBe(303);
        expect(location.pathname).toBe('/email-report/alerts');
        expect(location.search).toBe('');
    });

    it('비밀이 없으면 링크 없는 설정 페이지로 보낸다', () => {
        mocks.secret.mockReturnValue(null);

        const res = GET(new Request(validUrl()));

        expect(new URL(res.headers.get('location') ?? '').search).toBe('');
    });
});
