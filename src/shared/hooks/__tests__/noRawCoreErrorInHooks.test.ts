import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

/**
 * 분석 훅들이 **core가 만든 원시 문자열**을 화면에 던지지 못하게 한다.
 *
 * core의 실패 봉투는 `error`를 **항상** 채우고, 그 값은 로케일과 무관한 영어다:
 *   - `String(error)` (financials·fundamental·congress)
 *   - `Profile not found for symbol: AAPL`
 *   - `snapshot has no usable options chains`
 *   - `expiration 2026-09-18 not present in snapshot`
 *
 * 그래서 `result.error ?? messages.x` 형태는 **폴백이 절대 안 걸린다** — 카탈로그
 * 문구를 넣어 놓고도 전 로케일에 영어 예외가 그대로 나갔다. 한국어 사용자도
 * 마찬가지였다. 라운드 9~10에서 네 곳을 같은 이유로 고쳤고, 픽스처가 한국어라
 * (`'데이터 로드 실패'`) 테스트가 이 결함을 정상으로 단언하고 있었다.
 *
 * **허용**: `result.error.message` — 이건 siglens의 `buildGateError(code, locale)`가
 * 만든 객체라 이미 사용자 로케일이다.
 */
describe('분석 훅은 core 원시 에러 문자열을 화면에 던지지 않는다', () => {
    const HOOKS = [
        'src/views/symbol/hooks/useAnalysis.ts',
        'src/widgets/options/hooks/useOptionsAnalysis.ts',
        'src/widgets/financials/hooks/useFinancialsAnalysis.ts',
        'src/widgets/fundamental/hooks/useFundamentalAnalysis.ts',
        'src/widgets/news/hooks/useNewsAnalysis.ts',
        'src/widgets/overall/hooks/useOverallAnalysis.ts',
        'src/widgets/congress/hooks/useCongressTrend.ts',
    ];

    it('대상 훅을 실제로 읽는다', () => {
        // 경로가 바뀌어 빈 문자열을 읽으면 아래 단언이 통째로 무의미해진다.
        for (const rel of HOOKS) {
            expect(
                readFileSync(join(ROOT, rel), 'utf8').length
            ).toBeGreaterThan(500);
        }
    });

    it.each(HOOKS)('%s: 원시 error를 문구로 쓰지 않는다', rel => {
        const code = readFileSync(join(ROOT, rel), 'utf8')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/(?<![:/])\/\/.*$/gm, '');

        /**
         * 형태를 나열하지 않는다 — 나열하면 새 형태마다 뚫린다. 이 가드의 첫
         * 버전은 `??`와 `new XError(result.error)`만 봤고, `useOverallAnalysis`의
         * **삼항**(`typeof result.error === 'string' ? result.error : …`)을
         * 그대로 통과시켰다. 그 파일이 목록에 있는데도 8개가 전부 초록이었다.
         *
         * 대신 **화면에 뜨는 자리**만 본다: 에러 생성 인자다. `if (result.error)`
         * 같은 조건 검사나 `console.error(..., result.error)` 로깅은 문구가
         * 아니므로 대상이 아니다.
         */
        /**
         * 값을 **한 줄 위로 올리면** 인자 스캔만으로는 안 보인다:
         *   `const m = result.error as string;`
         *   `throw new OverallAnalysisError(m, result.axis);`
         * 감사가 이 형태와 `String(result.error.toString())`로 가드를 빠져나갔다.
         * 그래서 스캔 전에 **파일 안의 지역 변수 정의를 인라인**한다(한 단계).
         */
        const inlined = [
            ...code.matchAll(
                // `[^;\n]`으로 줄을 막으면 **여러 줄 초기화식을 통째로 놓친다** —
                // 그리고 이 레포의 포매터(oxfmt)는 그 형태를 강제로 여러 줄로
                // 감싼다. 즉 유일하게 포맷을 통과하는 작성법이 가드가 못 보는
                // 형태였다(감사 실증). 세미콜론까지 줄바꿈을 허용한다.
                /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*((?:[^;]*?result\.error[^;]*?));/g
            ),
        ].reduce(
            (acc, [, name, expression]) =>
                acc.replace(new RegExp(`\\b${name}\\b`, 'g'), expression),
            code
        );

        const messageArguments = [
            ...inlined.matchAll(
                /(?:new\s+\w*Error|throw\s+Error|set\w*Error)\(([\s\S]*?)\);/g
            ),
        ].map(m => m[1]);

        for (const argument of messageArguments) {
            /**
             * 허용은 **`result.error.<멤버>` 딱 그것만**이다 — siglens가
             * `buildGateError(code, locale)`로 만든, 이미 로케일화된 객체.
             *
             * 예전에는 `result.error[\s\S]{0,40}?.\w+`처럼 사이를 열어 뒀는데,
             * 두 번째 인자(`result.axis`)가 그 `.멤버`를 대신 만족시켜 **원시
             * `result.error`가 통째로 지워졌다.** 감사 실측: `??`·`||`·삼항·
             * 템플릿·`String()`, 심지어 **인자 그대로** 넘기는 형태까지 6종이
             * 전부 통과했다 — 이 가드를 만들게 한 바로 그 파일에서.
             */
            /**
             * 허용은 **`result.error.message`뿐**이다 — siglens의
             * `buildGateError(code, locale)`가 만든, 이미 로케일화된 객체.
             * `.\w+`로 열어 두면 `.toString()`·`.trim()`·`.stack`이 전부
             * 통과하는데, 그 결과는 전부 core의 **영어 원문**이다(감사 실증).
             */
            const residual = argument
                // siglens가 만든 게이트 에러 객체의 문구 — 이미 로케일화됐다.
                .replace(/result\.error\.message/g, '')
                // 타입 좁히기용 캐스트/검사. 문구로 쓰이는 게 아니다:
                //   `(result.error as { message?: string }).message`
                //   `typeof result.error === 'object' && result.error !== null`
                .replace(/\(\s*result\.error\s+as[^)]*\)\s*\.\s*\w+/g, '')
                .replace(/typeof\s+result\.error\s*[=!]==?\s*'[a-z]+'/g, '')
                .replace(/result\.error\s*[=!]==?\s*null/g, '');

            expect(residual).not.toMatch(/\bresult\.error\b/);
        }
    });
});
