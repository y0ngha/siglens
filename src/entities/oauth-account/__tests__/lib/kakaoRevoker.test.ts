import { vi, type Mock } from 'vitest';
import { kakaoOAuthRevokerAdapter } from '@/entities/oauth-account/lib/kakaoRevoker';

describe('kakaoOAuthRevokerAdapter.revokeToken', () => {
    const originalFetch = global.fetch;
    let fetchMock: Mock;

    beforeEach(() => {
        fetchMock = vi.fn();
        global.fetch = fetchMock as unknown as typeof fetch;
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('posts to the Kakao unlink endpoint with Bearer authorization', async () => {
        fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

        await kakaoOAuthRevokerAdapter.revokeToken({
            accessToken: 'kakao-access-token',
            refreshToken: null,
        });

        expect(fetchMock).toHaveBeenCalledWith(
            'https://kapi.kakao.com/v1/user/unlink',
            expect.objectContaining({
                method: 'POST',
                headers: { Authorization: 'Bearer kakao-access-token' },
            })
        );
    });

    it('passes an AbortSignal to fetch for timeout coverage', async () => {
        fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

        await kakaoOAuthRevokerAdapter.revokeToken({
            accessToken: 'kakao-access-token',
            refreshToken: null,
        });

        const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
        expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it('throws when the response status is not 200', async () => {
        fetchMock.mockResolvedValue(new Response(null, { status: 401 }));

        await expect(
            kakaoOAuthRevokerAdapter.revokeToken({
                accessToken: 'invalid-token',
                refreshToken: null,
            })
        ).rejects.toThrow('Kakao token revocation failed with status 401');
    });
});
