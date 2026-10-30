import {
    signupFocusTarget,
    type SignupStepErrors,
} from '@/features/auth-signup/lib/signupFocusTarget';
import { SIGNUP_FIELD_ID } from '@/features/auth-signup/lib/signupPhase';

const NO_ERRORS: SignupStepErrors = { email: null, code: null, details: null };

describe('signupFocusTarget', () => {
    it.each(['email', 'code', 'details'] as const)(
        'has no target in the %s step without an error',
        phase => {
            expect(signupFocusTarget(phase, NO_ERRORS)).toEqual({
                error: null,
                fieldId: null,
            });
        }
    );

    it('takes only the current step’s error', () => {
        const email = { code: 'invalid_email' as const, message: 'm' };
        const details = { code: 'consent_required' as const, message: 'm' };
        const errors: SignupStepErrors = { email, code: null, details };

        expect(signupFocusTarget('email', errors).error).toBe(email);
        expect(signupFocusTarget('code', errors).error).toBeNull();
        expect(signupFocusTarget('details', errors).error).toBe(details);
    });

    describe('email step', () => {
        it('targets the email input for a format error', () => {
            const error = { code: 'invalid_email' as const, message: 'm' };

            expect(
                signupFocusTarget('email', { ...NO_ERRORS, email: error })
            ).toEqual({ error, fieldId: SIGNUP_FIELD_ID.email });
        });

        it('does not move focus for a banner error', () => {
            const error = { code: 'redis_unavailable' as const, message: 'm' };

            expect(
                signupFocusTarget('email', { ...NO_ERRORS, email: error })
            ).toEqual({ error, fieldId: null });
        });
    });

    describe('code step', () => {
        it.each([
            'invalid_verification_code',
            'expired_verification_code',
        ] as const)('targets the code input for %s', code => {
            const error = { code, message: 'm' };

            expect(
                signupFocusTarget('code', { ...NO_ERRORS, code: error })
            ).toEqual({ error, fieldId: SIGNUP_FIELD_ID.code });
        });

        it('does not move focus for a banner error', () => {
            const error = {
                code: 'email_already_exists' as const,
                message: 'm',
            };

            expect(
                signupFocusTarget('code', { ...NO_ERRORS, code: error })
            ).toEqual({ error, fieldId: null });
        });
    });

    describe('details step', () => {
        it('targets the password input for a password error', () => {
            const error = {
                code: 'weak_password' as const,
                field: 'password' as const,
                message: 'm',
            };

            expect(
                signupFocusTarget('details', { ...NO_ERRORS, details: error })
            ).toEqual({ error, fieldId: SIGNUP_FIELD_ID.password });
        });

        it('does not move focus for a consent error', () => {
            const error = { code: 'consent_required' as const, message: 'm' };

            expect(
                signupFocusTarget('details', { ...NO_ERRORS, details: error })
            ).toEqual({ error, fieldId: null });
        });

        it('does not move focus for a banner error', () => {
            const error = {
                code: 'service_unavailable' as const,
                message: 'm',
            };

            expect(
                signupFocusTarget('details', { ...NO_ERRORS, details: error })
            ).toEqual({ error, fieldId: null });
        });
    });
});
