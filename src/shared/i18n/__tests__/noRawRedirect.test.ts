import { grepFiles } from '@/shared/test-utils/grepSource';

/**
 * 서버 리다이렉트의 로케일 유실 가드.
 *
 * ## 왜 액션별 단위 테스트로는 못 잡는가
 *
 * 액션 테스트는 `getLocale`을 `'ko'`로 mock한다. 그런데 ko는 접두사가 없어
 * `localePath('ko', '/') === '/'` — 즉 로케일을 붙이든 안 붙이든 결과가 **글자
 * 그대로 같다**. 리다이렉트 10곳 전부가 그렇게 검증되고 있었고, 이 코드가 존재하는
 * 이유(ja 사용자가 로그아웃 후 한국어 페이지에 떨어지지 않는 것)에 대한 판별력이
 * 0이었다. 소스 가드는 그 회귀를 잡고 미래에 추가될 리다이렉트까지 덮는다.
 *
 * 대상은 `localeRedirect` 래퍼가 아니라 **인자**다. `redirect()`를 직접 부르는
 * 곳들은 catch가 NEXT_REDIRECT를 재throw해야 해서 의도적으로 동기 호출을 쓰되
 * `localePath`/`localeHref`로 경로를 만든다(localeRedirect.ts JSDoc 참고).
 */
describe('서버 리다이렉트 로케일 가드', () => {
    const APP_PATHS = ['src/features', 'src/entities', 'src/app'];
    const isProd = (file: string) =>
        !file.includes('__tests__') && !file.includes('.test.');
    /**
     * 리다이렉트 대상이 이미 로케일이 붙은 경로라 헬퍼를 거치지 않는 파일.
     * 항목마다 그 경로가 어디서 로케일을 얻는지 적는다.
     */
    const LOCALE_PREFIXED_TARGET_FILES: ReadonlySet<string> = new Set([
        // OAuth state의 `next` — 로그인 화면이 로케일 접두사를 붙여 실었다.
        'src/app/api/auth/callback/_lib/redirectSignedIn.ts',
        // 받은 `url`을 내보내기만 하는 응답 빌더 — 호출부(handoff 라우트)가 `localePath`로 만든다.
        'src/app/api/auth/handoff/_shared/responses.ts',
    ]);

    it('리다이렉트 인자에 경로 리터럴을 직접 넣지 않는다', () => {
        // `redirect('/login')`처럼 리터럴로 시작하는 호출은 로케일을 잃는다.
        const offenders = grepFiles(
            String.raw`redirect\(\s*[\`'"]/`,
            APP_PATHS
        ).filter(isProd);
        expect(offenders).toEqual([]);
    });

    it('redirect를 부르는 파일은 로케일 헬퍼를 경유한다', () => {
        // 패턴이 줄 시작부터 `/`·`*`를 배제하는 이유는 주석 속 `redirect()`
        // 언급을 걸러내기 위해서다(이 클래스를 설명하는 주석이 실제로 여러 파일에
        // 붙어 있다).
        // ponytail: 파일 단위 검사라 한 파일에 로케일 인지/미인지 리다이렉트가
        // 섞이면 통과한다. AST로 올리는 건 실제로 섞인 파일이 생기면.
        // 헬퍼 검색도 같은 줄 패턴을 써서 주석 속 헬퍼 이름으로는 통과하지 못하게 한다.
        // `localePathToLogin`(app/[locale]/_personal)은 내부에서 `localePath`로 로그인 주소와
        // `next`를 모두 만드는 로케일 인지 헬퍼라 허용한다.
        const offenders = grepFiles(String.raw`^[^/*]*\bredirect\(`, APP_PATHS)
            .filter(isProd)
            .filter(file => !LOCALE_PREFIXED_TARGET_FILES.has(file))
            .filter(
                file =>
                    grepFiles(
                        String.raw`^[^/*]*\b(localePath|localeHref|localeRedirect|localePathToLogin)\b`,
                        [file]
                    ).length === 0
            );
        expect(offenders).toEqual([]);
    });

    it('예외 목록의 파일은 실제로 존재하고 redirect를 부른다', () => {
        // 파일이 옮겨지거나 리다이렉트가 사라지면 예외가 죽은 채 남지 않게 한다.
        const redirecting = new Set(
            grepFiles(String.raw`^[^/*]*\bredirect\(`, APP_PATHS)
        );
        expect(
            [...LOCALE_PREFIXED_TARGET_FILES].filter(f => !redirecting.has(f))
        ).toEqual([]);
    });

    it('양성 대조: grep이 실제로 동작한다', () => {
        // 0건 통과인지 검색 고장인지 구분한다.
        expect(
            grepFiles(String.raw`^[^/*]*\bredirect\(`, APP_PATHS).length
        ).toBeGreaterThan(5);
    });
});
