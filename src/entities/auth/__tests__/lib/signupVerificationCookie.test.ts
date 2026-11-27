import { EMAIL_VERIFICATION_VERIFIED_TTL_SECONDS } from '@/entities/auth/lib/authUseCaseConstants';
import {
    createExpiredSignupVerificationCookie,
    createSignupVerificationCookie,
} from '@/entities/auth/lib/signupVerificationCookie';
import { SIGNUP_VERIFICATION_COOKIE_NAME } from '@/shared/config/cookieNames';

describe('signupVerificationCookie', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('pins the cookie name literal (it is named in the privacy policy)', () => {
        expect(SIGNUP_VERIFICATION_COOKIE_NAME).toBe('siglens_signup_verify');
    });

    it('is HttpOnly, SameSite=Strict, host-only, and lives as long as the verified marker', () => {
        const cookie = createSignupVerificationCookie('nonce');

        expect(cookie).toMatchObject({
            name: 'siglens_signup_verify',
            value: 'nonce',
            httpOnly: true,
            sameSite: 'strict',
            path: '/',
            maxAge: EMAIL_VERIFICATION_VERIFIED_TTL_SECONDS,
        });
        expect(cookie).not.toHaveProperty('domain');
    });

    it('is Secure in production only', () => {
        vi.stubEnv('NODE_ENV', 'production');
        expect(createSignupVerificationCookie('n').secure).toBe(true);

        vi.stubEnv('NODE_ENV', 'development');
        expect(createSignupVerificationCookie('n').secure).toBe(false);
    });

    it('expiring cookie clears the same name and path with the same attributes', () => {
        vi.stubEnv('NODE_ENV', 'production');
        const issued = createSignupVerificationCookie('n');
        const expired = createExpiredSignupVerificationCookie();

        expect(expired).toMatchObject({
            name: issued.name,
            path: issued.path,
            sameSite: 'strict',
            httpOnly: true,
            secure: true,
            value: '',
            maxAge: 0,
        });
    });
});
