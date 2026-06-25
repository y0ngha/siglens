import { AUTH_SERVICE_UNAVAILABLE_MESSAGE } from '@/entities/auth/lib/errorMessages';

describe('auth error messages', () => {
    it('exports a non-empty Korean service unavailable message', () => {
        expect(AUTH_SERVICE_UNAVAILABLE_MESSAGE).toBeTruthy();
        expect(typeof AUTH_SERVICE_UNAVAILABLE_MESSAGE).toBe('string');
        expect(AUTH_SERVICE_UNAVAILABLE_MESSAGE).toMatch(/[가-힣]/);
    });
});
