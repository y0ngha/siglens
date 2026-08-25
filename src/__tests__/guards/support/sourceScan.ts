/**
 * 가드들이 공유하는 **소스 스캐너**.
 *
 * 왜 공통으로 뽑았나: 감사 네 라운드 동안 같은 부류의 결함이 계속 나왔다 —
 * 주석 안의 괄호를 세다가 캡처가 잘리고, 주석 안의 중괄호에 CSS 블록이 잘리고,
 * 주석 제거 규칙을 한 파일에서 고치면 쌍둥이 파일에는 그대로 남았다. 매번
 * 호출 지점에 새 정규식을 붙였기 때문이다. 문자열·주석 판별은 **한 번만**
 * 제대로 짜서 모두가 그것을 통과하도록 한다.
 *
 * 규칙 두 가지를 의도적으로 지킨다.
 *
 * 1. **길이를 보존한다.** 주석은 지우지 않고 같은 길이의 공백으로 바꾼다.
 *    지우면 이후 오프셋이 당겨져 보고되는 줄번호가 어긋나고, 틀린 좌표는
 *    지적이 없는 것보다 나쁘다(무관한 코드를 뒤지게 만든다).
 * 2. **JSX 텍스트의 `//`는 주석이 아니다.** `<h2>안내 // 참고</h2>`에서 그걸
 *    주석으로 보면 닫는 태그까지 지워져 다음 heading을 삼킨다 — 실제로 그
 *    형태로 진짜 위반이 숨은 적이 있다. 그래서 줄 주석은 **줄 맨 앞**이거나
 *    앞선 비공백 문자가 표현식 문맥(`,;({[=` 또는 따옴표)일 때만 인정한다.
 *    `https://`는 앞이 `:`라 자연히 제외된다.
 */

const EXPRESSION_CONTEXT = new Set([
    ',',
    ';',
    '(',
    '{',
    '[',
    '=',
    '+',
    "'",
    '"',
    '`',
    ')',
]);

/** 앞선 비공백 문자가 줄 주석을 허용하는 자리인가. */
function lineCommentAllowed(source: string, index: number): boolean {
    for (let i = index - 1; i >= 0; i -= 1) {
        const ch = source[i];
        if (ch === '\n') return true; // 줄 맨 앞(들여쓰기만 앞섬)
        if (ch === ' ' || ch === '\t') continue;
        return EXPRESSION_CONTEXT.has(ch);
    }
    return true;
}

/**
 * 주석을 같은 길이 공백으로 바꾼 사본. 문자열 안의 `//`·`/*`는 건드리지 않는다.
 *
 * 한 번의 좌→우 주사로 문자열·줄 주석·블록 주석 상태를 판별한다. 정규식 두
 * 개를 순서대로 돌리면 `// 메모: /* 정리`처럼 한쪽이 다른 쪽 안에 든 경우
 * 뒤 규칙이 앞 규칙의 결과를 넘어 25줄 아래 `*​/`까지 먹어치운다(실측).
 */
export function blankComments(source: string): string {
    const out = source.split('');
    let i = 0;
    while (i < source.length) {
        const ch = source[i];
        if (ch === '"' || ch === "'" || ch === '`') {
            const quote = ch;
            i += 1;
            while (i < source.length) {
                if (source[i] === '\\') {
                    i += 2;
                    continue;
                }
                if (source[i] === quote) break;
                i += 1;
            }
            i += 1;
            continue;
        }
        if (ch === '/' && source[i + 1] === '*') {
            let j = i + 2;
            while (
                j < source.length &&
                !(source[j] === '*' && source[j + 1] === '/')
            ) {
                j += 1;
            }
            const end = Math.min(j + 2, source.length);
            for (let k = i; k < end; k += 1) {
                if (out[k] !== '\n') out[k] = ' ';
            }
            i = end;
            continue;
        }
        if (
            ch === '/' &&
            source[i + 1] === '/' &&
            lineCommentAllowed(source, i)
        ) {
            let j = i;
            while (j < source.length && source[j] !== '\n') {
                out[j] = ' ';
                j += 1;
            }
            i = j;
            continue;
        }
        i += 1;
    }
    return out.join('');
}

/**
 * `start`에서 시작하는 초기화식을 **균형을 세어** 끝까지 읽는다.
 *
 * 게으른 `cn\([\s\S]*?\)`는 첫 `)`에서 잘린다 — 중첩 호출 하나만 끼어도 뒤
 * 인자가 통째로 안 보였다. 이 파일에서 한 번만 제대로 짜고, 상수든 객체
 * 속성이든 같은 리더를 쓴다(예전엔 각자 정규식을 들고 있다가 새로 만든 쪽이
 * 이미 고친 버그를 그대로 재현했다).
 *
 * 입력은 **주석이 이미 비워진** 소스여야 한다.
 */
export function readInitialiser(source: string, start: number): string {
    let depth = 0;
    let i = start;
    while (i < source.length) {
        const ch = source[i];
        if (ch === '"' || ch === "'" || ch === '`') {
            const quote = ch;
            i += 1;
            while (i < source.length) {
                if (source[i] === '\\') {
                    i += 2;
                    continue;
                }
                if (source[i] === quote) break;
                i += 1;
            }
            i += 1;
            if (depth === 0) return source.slice(start, i);
            continue;
        }
        if (ch === '(' || ch === '[') depth += 1;
        else if (ch === ')' || ch === ']') {
            depth -= 1;
            if (depth === 0) return source.slice(start, i + 1);
        } else if (depth === 0 && (ch === ';' || ch === '\n')) {
            return source.slice(start, i);
        }
        i += 1;
    }
    return source.slice(start);
}

/** 문자열을 Tailwind 토큰들로 쪼갠다. */
export function classTokens(value: string): string[] {
    return value.split(/[\s'"`,()]+/).filter(Boolean);
}
