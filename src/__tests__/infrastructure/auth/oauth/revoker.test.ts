jest.mock('@/infrastructure/auth/oauth/googleRevoker', () => ({
    googleOAuthRevokerAdapter: {
        revokeToken: jest.fn().mockResolvedValue(undefined),
    },
}));

jest.mock('@/infrastructure/auth/oauth/kakaoRevoker', () => ({
    kakaoOAuthRevokerAdapter: {
        revokeToken: jest.fn().mockResolvedValue(undefined),
    },
}));

import { compositeOAuthRevoker } from '@/infrastructure/auth/oauth/revoker';

describe('compositeOAuthRevoker', () => {
    it('delegates to the registered adapter for a known provider', async () => {
        const { googleOAuthRevokerAdapter } =
            await import('@/infrastructure/auth/oauth/googleRevoker');

        await compositeOAuthRevoker.revokeToken('google', {
            accessToken: 'access-token',
            refreshToken: null,
        });

        expect(googleOAuthRevokerAdapter.revokeToken).toHaveBeenCalledWith({
            accessToken: 'access-token',
            refreshToken: null,
        });
    });

    it('delegates to the kakao adapter for kakao provider', async () => {
        const { kakaoOAuthRevokerAdapter } =
            await import('@/infrastructure/auth/oauth/kakaoRevoker');

        await compositeOAuthRevoker.revokeToken('kakao', {
            accessToken: 'kakao-access-token',
            refreshToken: null,
        });

        expect(kakaoOAuthRevokerAdapter.revokeToken).toHaveBeenCalledWith({
            accessToken: 'kakao-access-token',
            refreshToken: null,
        });
    });

    it('skips silently when no adapter is registered for the provider', async () => {
        await expect(
            compositeOAuthRevoker.revokeToken('apple', {
                accessToken: 'access-token',
                refreshToken: null,
            })
        ).resolves.toBeUndefined();
    });
});
