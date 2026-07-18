import {
    DEFAULT_REDIRECT_PATH,
    resolvePostSignupDestination,
    sanitizeNextPath,
} from '@/shared/lib/auth/redirect';

describe('sanitizeNextPath', () => {
    it('null/undefined 입력은 기본 경로로 정규화된다', () => {
        expect(sanitizeNextPath(null)).toBe(DEFAULT_REDIRECT_PATH);
        expect(sanitizeNextPath(undefined)).toBe(DEFAULT_REDIRECT_PATH);
        expect(sanitizeNextPath('')).toBe(DEFAULT_REDIRECT_PATH);
    });

    it('절대 URL은 기본 경로로 정규화된다', () => {
        expect(sanitizeNextPath('https://evil.com/path')).toBe(
            DEFAULT_REDIRECT_PATH
        );
        expect(sanitizeNextPath('javascript:alert(1)')).toBe(
            DEFAULT_REDIRECT_PATH
        );
    });

    it('프로토콜 상대 경로와 역슬래시 호스트 경로는 기본 경로로 정규화된다', () => {
        expect(sanitizeNextPath('//evil.com')).toBe(DEFAULT_REDIRECT_PATH);
        expect(sanitizeNextPath('/\\evil.com')).toBe(DEFAULT_REDIRECT_PATH);
    });

    it('같은 origin path는 그대로 반환된다', () => {
        expect(sanitizeNextPath('/market')).toBe('/market');
        expect(sanitizeNextPath('/AAPL?range=1d')).toBe('/AAPL?range=1d');
    });
});

describe('resolvePostSignupDestination', () => {
    it("돌아갈 곳이 없는 가입('/')은 온보딩 화면으로 라우팅한다", () => {
        expect(resolvePostSignupDestination('/')).toBe('/onboarding');
    });

    it('특정 페이지에서 가입한 경우 그 페이지로 그대로 돌아간다', () => {
        expect(resolvePostSignupDestination('/AAPL')).toBe('/AAPL');
        expect(resolvePostSignupDestination('/account')).toBe('/account');
    });
});
