vi.mock('@/entities/oauth-account/lib/googleRevoker', () => ({
    googleOAuthRevokerAdapter: {
        revokeToken: vi.fn().mockResolvedValue(undefined),
    },
}));

import { compositeOAuthRevoker } from '@/entities/oauth-account/lib/revoker';

describe('compositeOAuthRevoker', () => {
    it('delegates to the registered adapter for a known provider', async () => {
        const { googleOAuthRevokerAdapter } =
            await import('@/entities/oauth-account/lib/googleRevoker');

        await compositeOAuthRevoker.revokeToken('google', {
            accessToken: 'access-token',
            refreshToken: null,
        });

        expect(googleOAuthRevokerAdapter.revokeToken).toHaveBeenCalledWith({
            accessToken: 'access-token',
            refreshToken: null,
        });
    });

    it.each(['apple', 'kakao'] as const)(
        'skips silently when no adapter is registered for %s',
        async provider => {
            await expect(
                compositeOAuthRevoker.revokeToken(provider, {
                    accessToken: 'access-token',
                    refreshToken: null,
                })
            ).resolves.toBeUndefined();
        }
    );
});
