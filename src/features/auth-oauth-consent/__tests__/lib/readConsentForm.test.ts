import {
    CONSENT_AGREED_VALUE,
    CONSENT_DECLINED_VALUE,
    readConsentForm,
} from '@/features/auth-oauth-consent/lib/readConsentForm';

function formData(fields: Record<string, string>): FormData {
    const fd = new FormData();
    Object.entries(fields).forEach(([key, value]) => fd.set(key, value));
    return fd;
}

describe('readConsentForm', () => {
    it('uses "true" as the agreed wire value', () => {
        expect(CONSENT_AGREED_VALUE).toBe('true');
    });

    it('uses "false" as the declined wire value, which never counts as agreed', () => {
        expect(CONSENT_DECLINED_VALUE).toBe('false');
        const input = formData({
            agreed_privacy: CONSENT_DECLINED_VALUE,
            agreed_tos: CONSENT_DECLINED_VALUE,
        });
        expect(readConsentForm(input).agreed).toBe(false);
    });

    it('reads a trimmed token', () => {
        expect(readConsentForm(formData({ token: '  tok-1  ' })).token).toBe(
            'tok-1'
        );
    });

    it('returns an empty token when the field is missing', () => {
        expect(readConsentForm(formData({})).token).toBe('');
    });

    it('treats both consents set to "true" as agreed', () => {
        const input = formData({ agreed_privacy: 'true', agreed_tos: 'true' });
        expect(readConsentForm(input).agreed).toBe(true);
    });

    it('is not agreed when only privacy is accepted', () => {
        const input = formData({ agreed_privacy: 'true', agreed_tos: 'false' });
        expect(readConsentForm(input).agreed).toBe(false);
    });

    it('is not agreed when a consent field is missing', () => {
        expect(
            readConsentForm(formData({ agreed_privacy: 'true' })).agreed
        ).toBe(false);
    });

    it('does not accept truthy look-alikes such as "on"', () => {
        const input = formData({ agreed_privacy: 'on', agreed_tos: 'on' });
        expect(readConsentForm(input).agreed).toBe(false);
    });
});
