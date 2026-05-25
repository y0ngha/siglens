vi.mock('@/features/auth-oauth', () => ({
    buildOAuthRedirectUri: vi
        .fn()
        .mockReturnValue('https://accounts.google.com/callback'),
    getOAuthAdapter: vi.fn().mockReturnValue({
        authorizeUrl: vi
            .fn()
            .mockReturnValue(new URL('https://accounts.google.com/authorize')),
    }),
    isOAuthProvider: vi.fn(),
    OAuthStateSecretMisconfiguredError: class extends Error {},
    issueOAuthState: vi.fn(),
}));
vi.mock('@/shared/lib/auth/redirect', () => ({
    sanitizeNextPath: vi.fn().mockImplementation((p: string) => p || '/'),
}));

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/auth/[provider]/start/route';
import {
    isOAuthProvider,
    issueOAuthState,
    OAuthStateSecretMisconfiguredError,
} from '@/features/auth-oauth';
import type { MockedFunction } from 'vitest';

const mockIsOAuthProvider = isOAuthProvider as MockedFunction<
    typeof isOAuthProvider
>;
const mockIssueOAuthState = issueOAuthState as MockedFunction<
    typeof issueOAuthState
>;

function makeRequest(provider: string, next?: string): NextRequest {
    const url = next
        ? `http://localhost/api/auth/${provider}/start?next=${encodeURIComponent(next)}`
        : `http://localhost/api/auth/${provider}/start`;
    return new NextRequest(url);
}

describe('GET /api/auth/[provider]/start', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('unknown provider', () => {
        it('redirects to /login?error=oauth_unknown', async () => {
            mockIsOAuthProvider.mockReturnValue(false);

            const res = await GET(makeRequest('unknown'), {
                params: Promise.resolve({ provider: 'unknown' }),
            });

            expect(res.status).toBe(307);
            const location = new URL(res.headers.get('location')!);
            expect(location.pathname).toBe('/login');
            expect(location.searchParams.get('error')).toBe('oauth_unknown');
        });
    });

    describe('valid provider', () => {
        beforeEach(() => {
            mockIsOAuthProvider.mockReturnValue(true);
        });

        it('redirects to the authorize URL with state cookie', async () => {
            mockIssueOAuthState.mockReturnValue({
                state: 'test-state',
                cookie: {
                    name: 'oauth_state',
                    value: 'test-cookie-value',
                    httpOnly: true,
                    secure: false,
                    sameSite: 'lax' as const,
                    maxAge: 600,
                    path: '/',
                    expires: new Date('2099-01-01'),
                },
            });

            const res = await GET(makeRequest('google'), {
                params: Promise.resolve({ provider: 'google' }),
            });

            expect(res.status).toBe(307);
            expect(res.headers.get('location')).toContain(
                'accounts.google.com/authorize'
            );
        });

        it('redirects to /login?error=oauth_unknown when state secret is misconfigured', async () => {
            mockIssueOAuthState.mockImplementation(() => {
                throw new OAuthStateSecretMisconfiguredError(
                    'secret not configured'
                );
            });

            const res = await GET(makeRequest('google'), {
                params: Promise.resolve({ provider: 'google' }),
            });

            expect(res.status).toBe(307);
            const location = new URL(res.headers.get('location')!);
            expect(location.pathname).toBe('/login');
            expect(location.searchParams.get('error')).toBe('oauth_unknown');
        });

        it('rethrows unexpected errors', async () => {
            mockIssueOAuthState.mockImplementation(() => {
                throw new Error('unexpected');
            });

            await expect(
                GET(makeRequest('google'), {
                    params: Promise.resolve({ provider: 'google' }),
                })
            ).rejects.toThrow('unexpected');
        });
    });
});
