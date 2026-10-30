import {
    derivePhase,
    PHASE_FIRST_FIELD_ID,
    SIGNUP_FIELD_ID,
} from '@/features/auth-signup/lib/signupPhase';

describe('derivePhase', () => {
    it('starts at the email step before a code is requested', () => {
        expect(derivePhase(false, false)).toBe('email');
    });

    it('moves to the code step once the code is requested', () => {
        expect(derivePhase(true, false)).toBe('code');
    });

    it('moves to the details step once the email is verified', () => {
        expect(derivePhase(true, true)).toBe('details');
    });

    it('treats verified as final even when the request state is not submitted', () => {
        expect(derivePhase(false, true)).toBe('details');
    });
});

describe('PHASE_FIRST_FIELD_ID', () => {
    it('focuses the email, code and name inputs in step order', () => {
        expect(PHASE_FIRST_FIELD_ID).toEqual({
            email: SIGNUP_FIELD_ID.email,
            code: SIGNUP_FIELD_ID.code,
            details: SIGNUP_FIELD_ID.name,
        });
    });
});

describe('SIGNUP_FIELD_ID', () => {
    it('keeps the input ids the signup page has always rendered', () => {
        expect(SIGNUP_FIELD_ID).toEqual({
            email: 'signup-email',
            code: 'signup-code',
            name: 'signup-name',
            password: 'signup-password',
        });
    });
});
