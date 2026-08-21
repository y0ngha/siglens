import { describe, expect, it } from 'vitest';
import { classify } from '../lib/context.mjs';
import { collectCandidates, parseFile } from '../lib/scan.mjs';

/**
 * `developer-diagnostic`는 **운영자만 읽는 문자열**을 미추출 집계에서 뺀다.
 *
 * 면제가 넓어지면 진짜 누락이 그 안에 묻힌다 — 그래서 (1) 콘솔 로그와
 * `[모듈]` 접두 throw만 면제되고 (2) 접두 없는 throw와 일반 문자열은 여전히
 * 걸리는지를 함께 본다. 이 가드가 없으면 "면제 사유를 넓혀 숫자를 줄이는"
 * 실패 모드가 조용히 통과한다.
 */
function reasonsFor(code: string, filePath = 'src/shared/lib/sample.ts') {
    const ast = parseFile(filePath, code);
    return [...collectCandidates(ast, code)].map(
        candidate => classify({ candidate, filePath, code }).reason
    );
}

describe('developer-diagnostic 분류', () => {
    it.each([
        ['console.warn', "console.warn('[krx] 예산 소진 — 중단');"],
        ['console.error', "console.error('[seo] 호스트가 다릅니다');"],
        ['템플릿 인자', 'console.warn(`[krx] ${count}일 안에서 찾지 못했다`);'],
    ])('%s는 면제된다', (_label, code) => {
        expect(reasonsFor(code)).toContain('developer-diagnostic');
    });

    it('`[모듈]` 접두가 붙은 throw는 면제된다', () => {
        expect(
            reasonsFor("throw new Error('[seo] 유효한 URL이 아닙니다.');")
        ).toContain('developer-diagnostic');
    });

    it('접두 없는 throw는 면제되지 않는다 — 사용자에게 노출될 수 있다', () => {
        expect(
            reasonsFor("throw new Error('로그인이 필요합니다.');")
        ).not.toContain('developer-diagnostic');
    });

    it('평범한 상수는 면제되지 않는다', () => {
        expect(reasonsFor("const LABEL = '강세';")).not.toContain(
            'developer-diagnostic'
        );
    });
});

/**
 * `e2e-stub`과 `log-fallback-message`도 같은 이유로 좁게 유지해야 한다 —
 * 면제 경로가 넓어지면 진짜 누락이 그 안에 묻힌다. 각각 (1) 면제되는 경우와
 * (2) 면제되면 **안 되는** 경우를 함께 본다.
 */
describe('e2e-stub 분류', () => {
    it('E2E 스텁 파일은 면제된다', () => {
        expect(
            reasonsFor(
                "const MSG = 'E2E 강제 분석 실패';",
                'src/shared/api/e2eAnalysisStub.ts'
            )
        ).toContain('e2e-stub');
    });

    it('같은 문자열이라도 프로덕션 모듈이면 면제되지 않는다', () => {
        expect(
            reasonsFor(
                "const MSG = 'E2E 강제 분석 실패';",
                'src/shared/api/realClient.ts'
            )
        ).not.toContain('e2e-stub');
    });
});

describe('log-fallback-message 분류', () => {
    const AUTH_LIB = 'src/entities/auth/lib/registerUser.ts';

    it('`_MESSAGE` 상수는 면제된다', () => {
        expect(
            reasonsFor(
                "const EMAIL_TAKEN_MESSAGE = '이미 사용 중인 이메일입니다.';",
                AUTH_LIB
            )
        ).toContain('log-fallback-message');
    });

    it('같은 디렉터리라도 `_MESSAGE`가 아닌 상수는 면제되지 않는다', () => {
        expect(
            reasonsFor("const SIGNUP_CTA = '회원가입하기';", AUTH_LIB)
        ).not.toContain('log-fallback-message');
    });

    it('`_MESSAGE` 이름이라도 다른 디렉터리면 면제되지 않는다', () => {
        expect(
            reasonsFor(
                "const HELLO_MESSAGE = '안녕하세요';",
                'src/widgets/analysis/copy.ts'
            )
        ).not.toContain('log-fallback-message');
    });
});

/**
 * `ai-prompt`도 좁게 유지한다 — `build*Prompt()` 안의 지시문만 면제하고,
 * 같은 파일의 다른 문자열은 여전히 잡혀야 한다.
 */
describe('ai-prompt 분류', () => {
    const TICKER_LIB = 'src/entities/ticker/lib/koreanTranslator.ts';

    it('`build*Prompt()` 안의 문자열은 면제된다', () => {
        expect(
            reasonsFor(
                "function buildTranslatePrompt() { return '한국어 이름으로 번역하세요'; }",
                TICKER_LIB
            )
        ).toContain('ai-prompt');
    });

    it('같은 파일이라도 다른 함수의 문자열은 면제되지 않는다', () => {
        expect(
            reasonsFor(
                "function describeError() { return '번역에 실패했어요'; }",
                TICKER_LIB
            )
        ).not.toContain('ai-prompt');
    });
});

/**
 * `native-language-label`은 언어 스위처의 자국어 표기 테이블만 면제한다.
 */
describe('native-language-label 분류', () => {
    it('LOCALE_NATIVE_LABEL은 면제된다', () => {
        expect(
            reasonsFor(
                "const LOCALE_NATIVE_LABEL = { ko: '한국어' };",
                'src/shared/i18n/locales.ts'
            )
        ).toContain('native-language-label');
    });

    it('같은 파일의 다른 테이블은 면제되지 않는다', () => {
        expect(
            reasonsFor(
                "const LOCALE_DESCRIPTION = { ko: '한국어로 봅니다' };",
                'src/shared/i18n/locales.ts'
            )
        ).not.toContain('native-language-label');
    });
});
