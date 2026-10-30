import { getEmailConfirmStatus } from '@/features/account-delete/lib/emailConfirmStatus';

describe('getEmailConfirmStatus', () => {
    const USER_EMAIL = 'user@example.com';

    it('returns empty for an empty or whitespace-only input', () => {
        expect(getEmailConfirmStatus('', USER_EMAIL)).toBe('empty');
        expect(getEmailConfirmStatus('   ', USER_EMAIL)).toBe('empty');
    });

    it('returns match ignoring case and surrounding whitespace', () => {
        expect(getEmailConfirmStatus('user@example.com', USER_EMAIL)).toBe(
            'match'
        );
        expect(getEmailConfirmStatus('  USER@Example.COM ', USER_EMAIL)).toBe(
            'match'
        );
    });

    it('returns mismatch for a different address', () => {
        expect(getEmailConfirmStatus('other@example.com', USER_EMAIL)).toBe(
            'mismatch'
        );
    });
});
