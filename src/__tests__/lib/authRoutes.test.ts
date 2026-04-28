import { AUTH_PATHS } from '@/lib/authRoutes';

describe('AUTH_PATHS', () => {
    it('인증 페이지 경로를 제공한다', () => {
        expect(AUTH_PATHS).toEqual({
            login: '/login',
            signup: '/signup',
        });
    });
});
