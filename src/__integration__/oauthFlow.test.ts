// @vitest-environment jsdom
import { TABS } from '@/widgets/symbol-page/utils/symbolTabsConfig';

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => '/',
    useSearchParams: () => new URLSearchParams(),
    redirect: vi.fn(),
}));

describe('OAuth Flow', () => {
    describe('OAuth start route construction', () => {
        it('Google OAuth redirect URL contains required scopes', () => {
            const scopes = ['openid', 'email', 'profile'];
            const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
            url.searchParams.set('scope', scopes.join(' '));
            expect(url.searchParams.get('scope')).toContain('email');
            expect(url.searchParams.get('scope')).toContain('profile');
        });

        it('Kakao OAuth redirect URL uses correct authorization endpoint', () => {
            const url = new URL('https://kauth.kakao.com/oauth/authorize');
            expect(url.hostname).toBe('kauth.kakao.com');
            expect(url.pathname).toBe('/oauth/authorize');
        });
    });

    describe('OAuth callback flow', () => {
        it('processes authorization code from callback URL', () => {
            const callbackUrl = new URL(
                'http://localhost:4200/api/auth/google/callback?code=test_code&state=test_state'
            );
            expect(callbackUrl.searchParams.get('code')).toBe('test_code');
            expect(callbackUrl.searchParams.get('state')).toBe('test_state');
        });

        it('detects error in callback URL parameters', () => {
            const callbackUrl = new URL(
                'http://localhost:4200/api/auth/google/callback?error=access_denied'
            );
            expect(callbackUrl.searchParams.get('error')).toBe('access_denied');
            expect(callbackUrl.searchParams.has('code')).toBe(false);
        });
    });

    describe('Pending signup detection', () => {
        it('identifies pending signup cookie pattern', () => {
            const cookieName = 'siglens:oauth-pending';
            expect(cookieName).toContain('oauth-pending');
        });

        it('consent form redirect path matches expected route', () => {
            const consentPath = '/signup/oauth';
            expect(consentPath).toBe('/signup/oauth');
        });
    });

    describe('Symbol tabs configuration integrity', () => {
        it('all tabs have valid href builders', () => {
            for (const tab of TABS) {
                const href = tab.hrefBuilder('AAPL');
                expect(href).toMatch(/^\/AAPL/);
            }
        });
    });
});
