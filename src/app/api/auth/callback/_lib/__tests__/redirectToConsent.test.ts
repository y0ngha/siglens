const { mockCreateStore } = vi.hoisted(() => ({ mockCreateStore: vi.fn() }));
vi.mock('@/entities/oauth-account/lib/pendingOAuthSignupStore', () => ({
    createPendingOAuthSignupStoreFromEnv: mockCreateStore,
}));
vi.mock('@/features/auth-oauth/lib/providers', () => ({
    getOAuthRedirectBaseUrl: vi.fn().mockReturnValue('https://siglens.io'),
}));
vi.mock('@/features/auth-oauth/lib/state', () => ({
    expiredOAuthStateCookie: vi
        .fn()
        .mockReturnValue({ name: 'oauth_state', value: '', maxAge: 0 }),
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    redirectToConsent,
    type OAuthProfile,
} from '@/app/api/auth/callback/_lib/redirectToConsent';

const PROFILE: OAuthProfile = {
    provider: 'google',
    providerAccountId: 'gid',
    email: 'new@example.com',
    name: 'New',
    avatarUrl: 'https://img/a.png',
};

function locationOf(response: Response): URL {
    return new URL(response.headers.get('location') ?? '');
}

describe('redirectToConsent', () => {
    beforeEach(() => {
        mockCreateStore.mockReset();
    });

    it('저장소가 없으면 oauth_unknown으로 로그인 화면에 돌려보낸다', async () => {
        mockCreateStore.mockReturnValue(null);

        const url = locationOf(await redirectToConsent('google', PROFILE, '/'));

        expect(url.pathname).toBe('/login');
        expect(url.searchParams.get('error')).toBe('oauth_unknown');
    });

    it('저장이 실패하면 oauth_unknown으로 돌려보내고 next를 유지한다', async () => {
        mockCreateStore.mockReturnValue({
            save: vi.fn().mockRejectedValue(new Error('redis down')),
        });

        const url = locationOf(
            await redirectToConsent('google', PROFILE, '/AAPL')
        );

        expect(url.searchParams.get('error')).toBe('oauth_unknown');
        expect(url.searchParams.get('next')).toBe('/AAPL');
    });

    it('저장에 성공하면 토큰만 실어 동의 화면으로 보낸다', async () => {
        mockCreateStore.mockReturnValue({
            save: vi.fn().mockResolvedValue('pending-token'),
        });

        const response = await redirectToConsent('google', PROFILE, '/');
        const url = locationOf(response);

        expect(url.pathname).toBe('/signup/oauth/consent');
        expect(url.searchParams.get('token')).toBe('pending-token');
        expect(url.search).not.toContain('example.com');
        expect(response.cookies.get('oauth_state')?.value).toBe('');
    });

    it('동의 화면 로케일은 next에서 복원한다', async () => {
        mockCreateStore.mockReturnValue({
            save: vi.fn().mockResolvedValue('t'),
        });

        const url = locationOf(
            await redirectToConsent('google', PROFILE, '/ja/AAPL')
        );

        expect(url.pathname).toBe('/ja/signup/oauth/consent');
    });

    it('프로필과 next를 저장소에 넘기고 accessToken이 없으면 빈 문자열이다', async () => {
        const save = vi.fn().mockResolvedValue('t');
        mockCreateStore.mockReturnValue({ save });

        await redirectToConsent('google', PROFILE, '/AAPL');

        expect(save).toHaveBeenCalledWith(
            expect.objectContaining({
                provider: 'google',
                email: 'new@example.com',
                providerAccountId: 'gid',
                accessToken: '',
                next: '/AAPL',
            })
        );
    });

    it('토큰 만료 시각은 ISO 문자열로 넘긴다', async () => {
        const save = vi.fn().mockResolvedValue('t');
        mockCreateStore.mockReturnValue({ save });

        await redirectToConsent(
            'google',
            {
                ...PROFILE,
                accessToken: 'at',
                tokenExpiresAt: new Date('2026-10-04T00:00:00.000Z'),
            },
            '/'
        );

        expect(save).toHaveBeenCalledWith(
            expect.objectContaining({
                accessToken: 'at',
                tokenExpiresAt: '2026-10-04T00:00:00.000Z',
            })
        );
    });
});
