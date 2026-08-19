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

describe('resolvePostSignupDestination — 로케일', () => {
    /**
     * 비-ko 사용자의 "돌아갈 곳 없음"은 `/`가 아니라 `/en`·`/ja`·`/zh`다.
     * 문자열 그대로 비교하면 지원 로케일 4개 중 3개에서 온보딩 정책이 죽는다
     * (실제로 `next`를 로케일화한 라운드에서 그 회귀가 났다).
     */
    it.each([
        ['/', '/onboarding'],
        ['/en', '/en/onboarding'],
        ['/ja', '/ja/onboarding'],
        ['/zh', '/zh/onboarding'],
    ])('%s → %s', (next, expected) => {
        expect(resolvePostSignupDestination(next)).toBe(expected);
    });

    it.each(['/AAPL', '/en/AAPL', '/ja/news/us'])(
        '%s: 구체적인 목적지는 그대로 둔다',
        next => {
            expect(resolvePostSignupDestination(next)).toBe(next);
        }
    );
});
