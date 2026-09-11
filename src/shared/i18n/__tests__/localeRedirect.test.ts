const { mockGetLocale, mockRedirect } = vi.hoisted(() => ({
    mockGetLocale: vi.fn(async () => 'ko'),
    mockRedirect: vi.fn(),
}));
vi.mock('next-intl/server', () => ({ getLocale: mockGetLocale }));
vi.mock('next/navigation', () => ({ redirect: mockRedirect }));
vi.mock('server-only', () => ({}));

import { localeHref, localeRedirect } from '../localeRedirect';

describe('localeHref', () => {
    beforeEach(() => {
        mockGetLocale.mockResolvedValue('ko');
        mockRedirect.mockClear();
    });

    it('기본 로케일은 접두사를 붙이지 않는다', async () => {
        await expect(localeHref('/account')).resolves.toBe('/account');
    });

    it('비-기본 로케일은 접두사를 붙인다', async () => {
        mockGetLocale.mockResolvedValue('ja');
        await expect(localeHref('/account')).resolves.toBe('/ja/account');
    });

    /**
     * 프록시 전방 가드가 발급한 `next`는 이미 접두사를 갖는다. 두 번 붙이면
     * `/en/en/account`가 되어 404가 난다.
     */
    it('이미 접두사가 있으면 두 번 붙이지 않는다', async () => {
        mockGetLocale.mockResolvedValue('en');
        await expect(localeHref('/en/account')).resolves.toBe('/en/account');
    });

    it('쿼리와 해시를 보존한다', async () => {
        mockGetLocale.mockResolvedValue('zh');
        await expect(localeHref('/login?password_reset=1#top')).resolves.toBe(
            '/zh/login?password_reset=1#top'
        );
    });

    /** `next`만 ko로 남으면 로그인 직후 언어가 사라진다. */
    it('next 쿼리 파라미터도 로케일화한다', async () => {
        mockGetLocale.mockResolvedValue('en');
        await expect(localeHref('/login?next=/account')).resolves.toBe(
            '/en/login?next=%2Fen%2Faccount'
        );
    });

    /**
     * SSO 핸드오프 복귀 경로. 접두사를 붙이면 404, 안쪽 `next`(ai 호스트 경로)를
     * 메인 로케일로 다시 쓰면 ai 로케일이 바뀐다 — 쿼리까지 바이트 그대로 둔다.
     */
    it('/api 경로는 쿼리째 그대로 둔다', async () => {
        mockGetLocale.mockResolvedValue('en');
        const href = '/api/auth/handoff?to=ai&next=%2Fja%2Fc%2Fx#h';
        await expect(localeHref(href)).resolves.toBe(href);
    });

    it('/api 경로에 잘못 붙어 온 로케일 접두사는 뗀다', async () => {
        mockGetLocale.mockResolvedValue('en');
        await expect(
            localeHref('/en/api/auth/handoff?to=ai&next=%2Fc%2Fx')
        ).resolves.toBe('/api/auth/handoff?to=ai&next=%2Fc%2Fx');
    });

    it('알 수 없는 로케일은 기본 로케일로 떨어진다', async () => {
        mockGetLocale.mockResolvedValue('xx');
        await expect(localeHref('/account')).resolves.toBe('/account');
    });
});

describe('localeRedirect', () => {
    it('로케일화한 경로로 redirect를 호출한다', async () => {
        mockGetLocale.mockResolvedValue('ja');
        mockRedirect.mockClear();
        await localeRedirect('/');
        expect(mockRedirect).toHaveBeenCalledWith('/ja');
    });
});
