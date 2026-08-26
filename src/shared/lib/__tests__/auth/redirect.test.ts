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
    it('host를 품은 값이 들어와도 경로만 남는다', () => {
        expect(toSameOriginPath('https://evil.com/x?a=1#f')).toBe('/x?a=1#f');
        expect(toSameOriginPath('//evil.com/x')).toBe('/x');
    });

    it('평범한 경로는 그대로 통과한다', () => {
        expect(toSameOriginPath('/market')).toBe('/market');
        expect(toSameOriginPath('/AAPL?range=1d')).toBe('/AAPL?range=1d');
    });

    it('파싱 불가 입력은 기본 경로로 떨어진다', () => {
        expect(toSameOriginPath('')).toBe('/');
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
