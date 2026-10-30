import {
    codeStepErrorSlot,
    detailsStepErrorSlot,
    emailStepErrorSlot,
} from '@/features/auth-signup/lib/signupErrorSlot';

describe('emailStepErrorSlot', () => {
    it('puts invalid_email on the email input', () => {
        expect(emailStepErrorSlot('invalid_email')).toBe('field');
    });

    it.each(['redis_unavailable', 'unexpected'] as const)(
        'puts %s in the banner',
        code => {
            expect(emailStepErrorSlot(code)).toBe('banner');
        }
    );
});

describe('codeStepErrorSlot', () => {
    it.each([
        'invalid_verification_code',
        'expired_verification_code',
    ] as const)('puts %s on the code input', code => {
        expect(codeStepErrorSlot(code)).toBe('field');
    });

    it.each([
        'email_already_exists',
        'redis_unavailable',
        'unexpected',
    ] as const)('puts %s in the banner', code => {
        expect(codeStepErrorSlot(code)).toBe('banner');
    });
});

describe('detailsStepErrorSlot', () => {
    it('routes consent_required to the consent group', () => {
        expect(
            detailsStepErrorSlot({ code: 'consent_required', message: 'm' })
        ).toBe('consent');
    });

    it('routes a password field error to the password input', () => {
        expect(
            detailsStepErrorSlot({
                code: 'weak_password',
                field: 'password',
                message: 'm',
            })
        ).toBe('password');
    });

    it('routes an email field error to the banner because this step has no email input', () => {
        expect(
            detailsStepErrorSlot({
                code: 'email_not_verified',
                field: 'email',
                message: 'm',
            })
        ).toBe('banner');
    });

    it('routes an error without a field to the banner', () => {
        expect(
            detailsStepErrorSlot({ code: 'service_unavailable', message: 'm' })
        ).toBe('banner');
    });
});
