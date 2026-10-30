import {
    FORGOT_PASSWORD_FALLBACK_ERROR_KEY,
    forgotPasswordErrorKey,
} from '@/features/auth-password-reset/lib/forgotPasswordErrorKey';
import { AUTH_ERROR_KEY } from '@/shared/lib/authErrorKey';

describe('forgotPasswordErrorKey', () => {
    it('returns undefined when there is no error code', () => {
        expect(forgotPasswordErrorKey(undefined)).toBeUndefined();
    });

    it('returns undefined for an empty error code', () => {
        expect(forgotPasswordErrorKey('')).toBeUndefined();
    });

    it('returns the mapped key for a known error code', () => {
        expect(forgotPasswordErrorKey('redis_unavailable')).toBe(
            AUTH_ERROR_KEY.redis_unavailable
        );
    });

    it('falls back to the invalid-email key for an unknown error code', () => {
        expect(forgotPasswordErrorKey('totally_unknown_code')).toBe(
            FORGOT_PASSWORD_FALLBACK_ERROR_KEY
        );
    });

    it('keeps the fallback pointed at the invalid-email message', () => {
        expect(FORGOT_PASSWORD_FALLBACK_ERROR_KEY).toBe('error.emailInvalid');
    });
});
