import { isSecureCookieEnv } from '@/infrastructure/auth/sessionCookieOptions';

describe('isSecureCookieEnv', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
        (process.env as { NODE_ENV?: string }).NODE_ENV = originalEnv;
    });

    it('NODE_ENV가 production이면 true', () => {
        (process.env as { NODE_ENV?: string }).NODE_ENV = 'production';
        expect(isSecureCookieEnv()).toBe(true);
    });

    it('NODE_ENV가 production이 아니면 false', () => {
        (process.env as { NODE_ENV?: string }).NODE_ENV = 'development';
        expect(isSecureCookieEnv()).toBe(false);
    });
});
