import {
    DEFAULT_REDIRECT_PATH,
    resolvePostSignupDestination,
    sanitizeNextPath,
    toSameOriginPath,
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

    /**
     * WHATWG URL 파서는 파싱 **전에** C0 제어문자와 공백을 제거한다. 그래서
     * `"/\t/evil.com"`은 접두사 검사(`//`, `/\`)를 그대로 통과한 뒤 파서가
     * 탭을 지우고 `"//evil.com"`으로 다시 읽어 off-origin이 된다.
     *
     * 실측(수정 전): sanitize가 입력을 그대로 돌려주고
     * `new URL(그 값, "https://siglens.io")`가 `"https://evil.com/"`이 됐다.
     */
    it.each(['\t', '\n', '\r', '\u0000', ' '])(
        '공백/제어문자(%j)를 품은 경로는 기본 경로로 정규화된다',
        ch => {
            expect(sanitizeNextPath(`/${ch}/evil.com`)).toBe(
                DEFAULT_REDIRECT_PATH
            );
        }
    );

    it('정제 결과가 파서에서 off-origin이 되지 않는다', () => {
        const base = 'https://siglens.io';
        for (const raw of [
            '/\t/evil.com',
            '/\n/evil.com',
            '/\r/evil.com',
            '//evil.com',
            '/\\evil.com',
            'https://evil.com/x',
        ]) {
            const resolved = new URL(sanitizeNextPath(raw), base);
            expect(resolved.origin, `raw=${JSON.stringify(raw)}`).toBe(base);
        }
    });
});

/**
 * 2차 방어. 문자열 검사에 새 우회가 생겨도 리디렉트를 내보내는 자리에서
 * origin이 바뀌지 않아야 한다 — 이 헬퍼가 없던 OAuth 콜백 한 곳이 정확히
 * 뚫려 있었다.
 */
describe('toSameOriginPath', () => {
    it('다른 origin으로 해석되는 값은 기본 경로로 떨어진다', () => {
        expect(toSameOriginPath('https://evil.com/x?a=1#f')).toBe(
            DEFAULT_REDIRECT_PATH
        );
        expect(toSameOriginPath('//evil.com/x')).toBe(DEFAULT_REDIRECT_PATH);
    });

    it('평범한 경로는 그대로 통과한다', () => {
        expect(toSameOriginPath('/market')).toBe('/market');
        expect(toSameOriginPath('/AAPL?range=1d')).toBe('/AAPL?range=1d');
    });

    it('파싱 불가 입력은 기본 경로로 떨어진다', () => {
        expect(toSameOriginPath('')).toBe('/');
    });
});

/**
 * Dot-segment 우회. `"/.//evil.com"`은 `//`로 시작하지 않아 접두사 검사를
 * 통과하지만, URL 파서가 dot segment를 접으면 경로가 `"//evil.com"`이 되고
 * 그 값으로 리다이렉트를 만들면 브라우저가 `https://evil.com`으로 간다.
 * `/en/en//evil.com`은 로케일 접두사를 두 번 벗기는 경로(`useLocalePath` →
 * `localeHref`)에서 같은 `//evil.com`이 된다.
 */
const PARSE_BASE = 'https://siglens.io';
const COLLAPSING_VECTORS = [
    '/.//evil.com',
    '/..//evil.com',
    '/%2e//evil.com',
    '/%2E//evil.com',
    '/a/..//evil.com',
    '/./\\evil.com',
    '/%2e%2e//evil.com',
    '/.\\\\evil.com',
    '/en//evil.com',
    '/en/en//evil.com',
];
// 파서가 off-origin으로 접지는 않지만 같은 계열의 변형 — 결과가 안전하기만 하면 된다.
const EDGE_VECTORS = ['/.%2F/evil.com', '/.\\evil.com', '/%2F/evil.com'];

function expectSafeRedirectPath(out: string): void {
    const url = new URL(out, PARSE_BASE);
    expect(url.origin).toBe(PARSE_BASE);
    expect(out.startsWith('//')).toBe(false);
    expect(out.startsWith('/\\')).toBe(false);
    expect(url.pathname.includes('//')).toBe(false);
}

describe('dot-segment open redirect', () => {
    it.each(COLLAPSING_VECTORS)(
        'sanitizeNextPath(%j)는 기본 경로로 정규화된다',
        raw => {
            expect(sanitizeNextPath(raw)).toBe(DEFAULT_REDIRECT_PATH);
        }
    );

    it.each(COLLAPSING_VECTORS)(
        'toSameOriginPath(%j)는 기본 경로로 정규화된다',
        raw => {
            expect(toSameOriginPath(raw)).toBe(DEFAULT_REDIRECT_PATH);
        }
    );

    it.each([...COLLAPSING_VECTORS, ...EDGE_VECTORS])(
        '%j: 어느 함수의 결과도 off-origin이 되지 않는다',
        raw => {
            expectSafeRedirectPath(sanitizeNextPath(raw));
            expectSafeRedirectPath(toSameOriginPath(raw));
            expectSafeRedirectPath(toSameOriginPath(sanitizeNextPath(raw)));
        }
    );

    it.each([
        '/',
        '/AAPL',
        '/en/market?x=1#h',
        '/account/api-keys',
        '/%ED%95%9C%EA%B8%80',
        '/api/auth/handoff?to=ai&next=%2Fc%2Fabc',
    ])('정상 경로 %j는 두 함수 모두 그대로 통과한다', path => {
        expect(sanitizeNextPath(path)).toBe(path);
        expect(toSameOriginPath(path)).toBe(path);
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
