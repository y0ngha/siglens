/**
 * Branch coverage tests for finalizeOAuthSignupAction — targets uncovered:
 * - L28-30: formData.get('token'|'agreed_privacy'|'agreed_tos') ?? '' when field is missing
 * - L86: sanitizeNextPath(profile.next) cond-expr fallback
 */

import type { Mock } from 'vitest';

vi.mock('@/entities/oauth-account', () => ({
    DrizzleOAuthAccountRepository: vi.fn().mockImplementation(function () {
        return {};
    }),
    compositeOAuthRevoker: { revokeToken: vi.fn() },
    createPendingOAuthSignupStore: vi.fn(),
    createPendingOAuthSignupStoreFromEnv: vi.fn(),
}));
vi.mock('@/entities/terms');
vi.mock('@/entities/user');
vi.mock('@/entities/agreement');
vi.mock('@/entities/session', () => ({
    applyAuthCookie: vi.fn((c: unknown) => c),
    createAuthHintCookie: vi.fn(() => ({
        name: 'auth_hint',
        value: 'true',
    })),
    CONSENT_REQUIRED_MESSAGE: '서비스 이용을 위해 필수 약관에 동의해 주세요.',
    OAUTH_ERROR_REDIRECT: {
        consentInvalid: '/login?error=oauth_consent_invalid',
        consentExpired: '/login?error=oauth_consent_expired',
        serviceUnavailable: '/login?error=service_unavailable',
        emailConflict: '/login?error=oauth_email_conflict',
    },
    createAuthSession: vi.fn(),
    DEFAULT_SESSION_TTL_SECONDS: 7776000,
    isSecureCookieEnv: vi.fn(() => false),
    DrizzleSessionRepository: vi.fn().mockImplementation(function () {
        return {};
    }),
}));
// getAuthDatabaseClient는 barrel이 아닌 @/entities/session/lib/db에서 직접 import되므로
// (server-only 체인을 client 번들에서 분리) 해당 경로를 별도로 mock한다.
vi.mock('@/entities/session/lib/db', () => ({
    getAuthDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));
vi.mock('next/headers', () => ({
    cookies: vi.fn(),
}));
vi.mock('@/shared/lib/auth/redirect', () => ({
    sanitizeNextPath: vi.fn((p: unknown) => (typeof p === 'string' ? p : '/')),
}));
vi.mock('next/navigation', () => ({
    redirect: vi.fn().mockImplementation((url: string) => {
        throw Object.assign(new Error('NEXT_REDIRECT'), { url });
    }),
}));

import { finalizeOAuthSignupAction } from '@/features/auth-oauth-consent/actions/finalizeOAuthSignupAction';
import { redirect } from 'next/navigation';

const mockRedirect = redirect as unknown as Mock;

describe('finalizeOAuthSignupAction — null coalescing branches', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('falls back to empty string when token field is missing from formData', async () => {
        // FormData without token, agreed_privacy, or agreed_tos fields
        const fd = new FormData();
        // Missing all fields → formData.get() returns null → ?? '' triggers

        await expect(finalizeOAuthSignupAction({}, fd)).rejects.toThrow(
            'NEXT_REDIRECT'
        );
        expect(mockRedirect).toHaveBeenCalledWith(
            '/login?error=oauth_consent_invalid'
        );
    });

    it('treats missing agreed fields as empty strings (consent required)', async () => {
        const fd = new FormData();
        fd.set('token', 'some-token');
        // agreed_privacy and agreed_tos are missing → get() returns null → ?? '' gives ''
        // '' !== 'true' → consent_required

        const result = await finalizeOAuthSignupAction({}, fd);
        expect(result.error?.code).toBe('consent_required');
    });
});
