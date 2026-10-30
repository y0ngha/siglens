import { resetPasswordErrorSlot } from '@/features/auth-password-reset/lib/resetPasswordErrorSlot';

describe('resetPasswordErrorSlot', () => {
    it('places a password-field error under the new-password input', () => {
        expect(
            resetPasswordErrorSlot({
                code: 'weak_password',
                field: 'password',
                message: 'weak',
            })
        ).toBe('password');
    });

    it('places a token-field error in the form banner', () => {
        expect(
            resetPasswordErrorSlot({
                code: 'invalid_token',
                field: 'token',
                message: 'invalid',
            })
        ).toBe('form');
    });

    it('places a field-less domain error in the form banner', () => {
        expect(
            resetPasswordErrorSlot({ code: 'same_password', message: 'same' })
        ).toBe('form');
    });

    it('places an unexpected error in the form banner', () => {
        expect(
            resetPasswordErrorSlot({ code: 'unexpected', message: 'boom' })
        ).toBe('form');
    });

    it('places a hidden email-field error in the form banner', () => {
        expect(
            resetPasswordErrorSlot({
                code: 'invalid_email',
                field: 'email',
                message: 'bad email',
            })
        ).toBe('form');
    });
});
