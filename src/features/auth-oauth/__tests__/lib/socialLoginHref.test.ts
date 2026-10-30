import { buildSocialLoginHref } from '@/features/auth-oauth/lib/socialLoginHref';

describe('buildSocialLoginHref', () => {
    it('next가 없으면 provider 시작 라우트만 돌려준다', () => {
        expect(buildSocialLoginHref('google')).toBe('/api/auth/google/start');
    });

    it('빈 문자열 next는 쿼리를 붙이지 않는다', () => {
        expect(buildSocialLoginHref('google', '')).toBe(
            '/api/auth/google/start'
        );
    });

    it('next를 URL 인코딩해 쿼리로 붙인다', () => {
        expect(
            buildSocialLoginHref('google', '/api/auth/handoff?to=ai&next=/c/1')
        ).toBe(
            '/api/auth/google/start?next=%2Fapi%2Fauth%2Fhandoff%3Fto%3Dai%26next%3D%2Fc%2F1'
        );
    });
});
