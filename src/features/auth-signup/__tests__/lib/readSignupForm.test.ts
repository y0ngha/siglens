import { readSignupForm } from '@/features/auth-signup/lib/readSignupForm';
import { DEFAULT_REDIRECT_PATH } from '@/shared/lib/auth/redirect';
import { makeFormData } from '@/shared/test-utils/makeFormData';

const CONSENTED = { agreed_privacy: 'true', agreed_tos: 'true' };

describe('readSignupForm', () => {
    it('trims the email', () => {
        const input = readSignupForm(
            makeFormData({ ...CONSENTED, email: '  a@b.com ' })
        );
        expect(input.email).toBe('a@b.com');
    });

    it('keeps the password exactly as typed', () => {
        const input = readSignupForm(
            makeFormData({ ...CONSENTED, password: ' pass word1 ' })
        );
        expect(input.password).toBe(' pass word1 ');
    });

    it('reads missing email and password as empty strings', () => {
        const input = readSignupForm(makeFormData(CONSENTED));
        expect(input).toMatchObject({ email: '', password: '' });
    });

    it('trims the name', () => {
        const input = readSignupForm(
            makeFormData({ ...CONSENTED, name: '  Kim  ' })
        );
        expect(input.name).toBe('Kim');
    });

    it('reads a blank name as undefined', () => {
        const input = readSignupForm(
            makeFormData({ ...CONSENTED, name: '   ' })
        );
        expect(input.name).toBeUndefined();
    });

    it('keeps a same-origin next path', () => {
        const input = readSignupForm(
            makeFormData({ ...CONSENTED, next: '/AAPL' })
        );
        expect(input.next).toBe('/AAPL');
    });

    it('drops an off-origin next to the default path', () => {
        const input = readSignupForm(
            makeFormData({ ...CONSENTED, next: '//evil.example' })
        );
        expect(input.next).toBe(DEFAULT_REDIRECT_PATH);
    });

    it('reports consent when both agreements are true', () => {
        expect(readSignupForm(makeFormData(CONSENTED)).hasRequiredConsent).toBe(
            true
        );
    });

    it('reports no consent when privacy is false', () => {
        const input = readSignupForm(
            makeFormData({ ...CONSENTED, agreed_privacy: 'false' })
        );
        expect(input.hasRequiredConsent).toBe(false);
    });

    it('reports no consent when tos is missing', () => {
        const input = readSignupForm(makeFormData({ agreed_privacy: 'true' }));
        expect(input.hasRequiredConsent).toBe(false);
    });
});
