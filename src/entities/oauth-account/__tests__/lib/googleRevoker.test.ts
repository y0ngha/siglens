import type { Mock } from 'vitest';
import { googleOAuthRevokerAdapter } from '@/entities/oauth-account/lib/googleRevoker';

describe('googleOAuthRevokerAdapter.revokeToken', () => {
    const originalFetch = global.fetch;
    let fetchMock: Mock;

    beforeEach(() => {
        fetchMock = vi.fn();
        global.fetch = fetchMock as unknown as typeof fetch;
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('posts to the Google revocation endpoint with the access token', async () => {
        fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

        await googleOAuthRevokerAdapter.revokeToken({
            accessToken: 'ya29.access-token',
            refreshToken: null,
        });

        expect(fetchMock).toHaveBeenCalledWith(
            'https://oauth2.googleapis.com/revoke?token=ya29.access-token',
            expect.objectContaining({ method: 'POST' })
        );
    });

    it('encodes special characters in the access token', async () => {
        fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

        await googleOAuthRevokerAdapter.revokeToken({
            accessToken: 'token with spaces & special=chars',
            refreshToken: null,
        });

        const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
        expect(calledUrl).toContain(
            encodeURIComponent('token with spaces & special=chars')
        );
    });

    it('passes an AbortSignal to fetch for timeout coverage', async () => {
        fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

        await googleOAuthRevokerAdapter.revokeToken({
            accessToken: 'ya29.access-token',
            refreshToken: null,
        });

        const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
        expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it('throws when the response status is not 200', async () => {
        fetchMock.mockResolvedValue(new Response(null, { status: 400 }));

        await expect(
            googleOAuthRevokerAdapter.revokeToken({
                accessToken: 'expired-token',
                refreshToken: null,
            })
        ).rejects.toThrow('Google token revocation failed with status 400');
    });
});
