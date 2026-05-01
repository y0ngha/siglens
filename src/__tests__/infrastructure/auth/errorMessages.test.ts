import { AUTH_SERVICE_UNAVAILABLE_MESSAGE } from '@/infrastructure/auth/errorMessages';

describe('auth error messages', () => {
    it('exports a non-empty Korean service unavailable message', () => {
        expect(AUTH_SERVICE_UNAVAILABLE_MESSAGE).toBeTruthy();
        expect(typeof AUTH_SERVICE_UNAVAILABLE_MESSAGE).toBe('string');
    });
});
