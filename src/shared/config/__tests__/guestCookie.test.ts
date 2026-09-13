import {
    GUEST_ID_MAX_AGE_SECONDS,
    guestIdCookieOptions,
    isValidGuestId,
} from '@/shared/config/guestCookie';

describe('isValidGuestId', () => {
    it('유효한 UUID면 true', () => {
        expect(isValidGuestId('11111111-1111-1111-1111-111111111111')).toBe(
            true
        );
    });
    it('undefined면 false', () => {
        expect(isValidGuestId(undefined)).toBe(false);
    });
    it('UUID 형식이 아니면 false', () => {
        expect(isValidGuestId('not-a-uuid')).toBe(false);
    });
});

describe('guestIdCookieOptions', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    afterEach(() => {
        (process.env as { NODE_ENV?: string }).NODE_ENV = originalNodeEnv;
    });

    it('production에서는 secure: true', () => {
        (process.env as { NODE_ENV?: string }).NODE_ENV = 'production';
        expect(guestIdCookieOptions()).toEqual({
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            path: '/',
            maxAge: GUEST_ID_MAX_AGE_SECONDS,
        });
    });

    it('production이 아니면 secure: false', () => {
        (process.env as { NODE_ENV?: string }).NODE_ENV = 'test';
        expect(guestIdCookieOptions().secure).toBe(false);
    });

    it('maxAge는 1년(초)', () => {
        expect(GUEST_ID_MAX_AGE_SECONDS).toBe(60 * 60 * 24 * 365);
    });
});
