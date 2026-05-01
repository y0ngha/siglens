import { applyAuthCookie } from '@/infrastructure/auth/applyAuthCookie';
import type { AuthSessionCookie } from '@/infrastructure/auth/use-cases/types';

describe('applyAuthCookie', () => {
    it('AuthSessionCookie 메타를 next/headers cookies().set 형식으로 매핑한다', () => {
        const expires = new Date('2030-01-01T00:00:00.000Z');
        const cookie: AuthSessionCookie = {
            name: 'siglens_session',
            value: 'token-abc',
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            path: '/',
            expires,
            maxAgeSeconds: 86400,
        };
        expect(applyAuthCookie(cookie)).toEqual({
            name: 'siglens_session',
            value: 'token-abc',
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            path: '/',
            expires,
            maxAge: 86400,
        });
    });
});
