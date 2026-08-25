import { parse } from '@babel/parser';

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

/**
 * 주석 구간을 **TypeScript 자신의 파서**로 구한다.
 *
 * 손으로 짠 스캐너를 네 번 고쳤고 네 번 다 새 구멍이 남았다 — 정규식 리터럴
 * 안의 따옴표가 가짜 문자열을 열어 파일 뒷부분의 주석 제거가 통째로 꺼졌고,
 * 템플릿 보간 안의 주석이 통째로 안 지워졌고, `//`가 주석인지 JSX 텍스트인지를
 * 앞 문자로 추론하다 양방향으로 틀렸다(`||` 뒤 주석은 놓치고, heading 본문의
 * `//`는 닫는 태그를 지워 다음 heading을 삼켰다).
 *
 * 그 판별은 이미 정확히 구현된 것이 있고, 이 레포의 직접 의존이다. 주석은
 * 파서에게 **trivia**이고 JSX 텍스트 안의 `//`는 trivia가 아니므로, 양방향이
 * 정의상 옳아진다. 가드는 테스트라 파서를 부르는 비용이 문제되지 않는다.
 */
function commentRanges(source: string): { pos: number; end: number }[] {
    const ast = parse(source, {
        sourceType: 'module',
        errorRecovery: true,
        plugins: ['typescript', 'jsx'],
    });
    return (ast.comments ?? [])
        .filter(c => c.start != null && c.end != null)
        .map(c => ({ pos: c.start as number, end: c.end as number }));
}

/**
 * 주석을 같은 길이 공백으로 바꾼 사본.
 *
 * **길이를 보존한다.** 지우면 이후 오프셋이 당겨져 보고되는 줄번호가 어긋나고,
 * 틀린 좌표는 지적이 없는 것보다 나쁘다 — 무관한 코드를 뒤지게 만든다.
 */
export function blankComments(source: string): string {
    const out = source.split('');
    for (const { pos, end } of commentRanges(source)) {
        for (let i = pos; i < end && i < out.length; i += 1) {
            if (out[i] !== '\n') out[i] = ' ';
        }
    }
    return out.join('');
}

/**
 * CSS용 주석 제거. CSS에는 `/* *​/` 하나뿐이라 파서가 필요 없다.
 *
 * JS용과 나눠 둔 이유: 같은 함수를 쓰다가 babel이 `@theme`에서 막혔다.
 * 문법이 다른 두 언어를 한 함수로 처리하려 한 것 자체가 잘못이었다.
 */
export function blankCssComments(source: string): string {
    const out = source.split('');
    let i = 0;
    while (i < source.length) {
        if (source[i] === '/' && source[i + 1] === '*') {
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
            // 문자열이 닫혔다고 끝내지 않는다. `'a' + 'b'`처럼 이어붙이는
            // 초기화식에서 뒤쪽이 통째로 안 읽혔다 — 그리고 그 뒤에 위반이
            // 있었다. 종료는 아래 `;`/개행 규칙이 판단한다.
            continue;
        }
        if (ch === '(' || ch === '[' || ch === '{') depth += 1;
        else if (ch === ')' || ch === ']' || ch === '}') {
            depth -= 1;
            // **닫는 괄호에서 끝내지 않는다.** 그러면 `const X = (a) => cn(...)`가
            // 매개변수 목록만 남고 본문이 통째로 안 읽힌다 — 감사가 실제로 그
            // 형태로 위반을 통과시켰다. `f() + ' cls'`, `[...].join(' ')`도 같은
            // 이유로 잘렸다. 종료는 아래 `;`/개행 규칙만 판단한다.
            if (depth < 0) return source.slice(start, i);
        } else if (depth === 0 && (ch === ';' || ch === '\n')) {
            // 이어지는 줄(연산자로 끝나거나 다음 줄이 이어붙임)이면 계속 읽는다.
            const rest = source.slice(i + 1);
            const cont = /^\s*(?:[+.]|\?\?|\|\||&&|\))/.test(rest);
            const trailing = /[+({[,?:]\s*$/.test(source.slice(start, i));
            if (!cont && !trailing) return source.slice(start, i);
        }
        i += 1;
    }
    return source.slice(start);
}

/**
 * 문자열을 Tailwind 토큰들로 쪼갠다.
 *
 * **대괄호 임의값 안은 쪼개지 않는다.** 쉼표로 무조건 나눴더니
 * `transition-[background-color,border-color]`가 `border-color`라는 없는
 * 토큰을 만들어냈고, 색 판정이 그걸 해석하려다 실패했다.
 */
export function classTokens(value: string): string[] {
    const out: string[] = [];
    let buf = '';
    let bracket = 0;
    for (const ch of value) {
        if (ch === '[') bracket += 1;
        else if (ch === ']') bracket -= 1;
        // 대괄호 안에서도 **따옴표는 언제나 구분자**다. 그래야
        // `['border-…'].join(' ')` 같은 배열이 쪼개지고,
        // `transition-[background-color,border-color]` 같은 임의값은 붙어 있다.
        // 배열인지 아닌지를 추측하려 했더니 `props['aria-selected']`가 섞인
        // className에서 판정이 뒤집혀, `aria-[…]:border-…` 변형 토큰이 세 조각으로
        // 찢어졌고 그 바람에 위반 하나가 판정 함수에 닿지도 못했다.
        const sep = bracket > 0 ? /['"`]/.test(ch) : /[\s'"`,()]/.test(ch);
        if (sep) {
            if (buf !== '') out.push(buf);
            buf = '';
            continue;
        }
        buf += ch;
    }
    if (buf !== '') out.push(buf);
    return out.map(x => x.replace(/^\[+|\]+$/g, '')).filter(Boolean);
}
