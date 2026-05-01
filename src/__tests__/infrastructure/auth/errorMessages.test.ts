import { AUTH_SERVICE_UNAVAILABLE_MESSAGE } from '@/infrastructure/auth/errorMessages';

describe('auth error messages', () => {
    it('exports the shared service unavailable message', () => {
        expect(AUTH_SERVICE_UNAVAILABLE_MESSAGE).toBe(
            '서비스가 일시적으로 동작하지 않습니다. 잠시 후 다시 시도해주세요.'
        );
    });
});
