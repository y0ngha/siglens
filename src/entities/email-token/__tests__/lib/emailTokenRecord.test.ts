import {
    buildEmailTokenKey,
    parseEmailTokenValue,
} from '../../lib/emailTokenRecord';

const HASH = 'a'.repeat(64);

describe('buildEmailTokenKey', () => {
    it('namespaces password reset and email verification keys separately', () => {
        const email = 'user@example.com';
        expect(buildEmailTokenKey('password_reset', email)).toBe(
            'email_token:password_reset:user@example.com'
        );
        expect(buildEmailTokenKey('email_verification', email)).toBe(
            'email_token:email_verification:user@example.com'
        );
    });
});

describe('parseEmailTokenValue', () => {
    it('keeps a verified marker', () => {
        expect(parseEmailTokenValue({ status: 'verified' })).toEqual({
            status: 'verified',
        });
    });

    it('keeps a pending value with a non-hex hash so the comparison step rejects it as invalid', () => {
        expect(
            parseEmailTokenValue({ status: 'pending', tokenHash: 'abc' })
        ).toEqual({ status: 'pending', tokenHash: 'abc' });
    });

    it('keeps a pending value with a sha256 hex hash', () => {
        expect(
            parseEmailTokenValue({ status: 'pending', tokenHash: HASH })
        ).toEqual({ status: 'pending', tokenHash: HASH });
    });

    it('drops unknown extra fields', () => {
        expect(
            parseEmailTokenValue({
                status: 'pending',
                tokenHash: HASH,
                extra: 1,
            })
        ).toEqual({ status: 'pending', tokenHash: HASH });
    });

    it.each([
        ['null', null],
        ['undefined', undefined],
        ['a string', 'pending'],
        ['a number', 1],
        ['an empty object', {}],
        ['an unknown status', { status: 'expired' }],
        ['pending without hash', { status: 'pending' }],
        ['pending with a non-string hash', { status: 'pending', tokenHash: 1 }],
    ])('returns null for %s', (_label, raw) => {
        expect(parseEmailTokenValue(raw)).toBeNull();
    });
});
