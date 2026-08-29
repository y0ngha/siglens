import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { blankComments } from './sourceScan';

/**
 * 어떤 클래스 상수가 **컨트롤에 쓰이는가**를 트리 전체에서 모은 색인.
 *
 * 예전엔 상수를 선언한 **같은 파일 안에서만** 컨트롤 태그를 찾았다. 그런데 이
 * 브랜치가 새로 만든 클래스 모듈(`shared/lib/*Styles.ts`)에는 JSX가 아예 없어,
 * 거기 사는 상수는 어디에 쓰이든 감시 밖이었다 — `SURFACE_CARD`를 컨트롤에
 * 그대로 얹어도 가드 5개가 전부 초록이었다. 파일 경계를 넘어 "이 이름이
 * 컨트롤 태그의 className에 등장하는가"를 본다.
 *
 * 한계: **이름 기준**이다. 서로 다른 파일이 같은 이름의 상수를 쓰면 함께
 * 묶인다. import를 따라가는 대신 이름을 믿는 대가이며, 이 레포에서는 클래스
 * 상수 이름이 충분히 특이해 실효가 없다.
 */

export const CONTROL_TAGS = 'button|a|input|textarea|select|Link';

export interface OpeningTag {
    tag: string;
    index: number;
}

/**
 * 여는 태그 전체. 따옴표와 중괄호 균형을 세어 끝을 찾는다 — `[^>]*`로 자르면
 * 문자열 안의 `>` 하나에 태그가 잘려 뒤쪽 className이 통째로 안 보인다
 * (그렇게 12개가 숨어 있었다).
 *
 * `tags`는 파이프로 구분한 태그 이름. 기본값은 컨트롤 계열이고, SVG 글자
 * (`text`/`tspan`)처럼 다른 계열을 훑는 가드가 같은 리더를 쓴다 — 각자
 * 정규식을 들고 있다가 이미 고친 절단 버그를 재현하는 걸 막는다.
 */
export function controlOpeningTags(
    source: string,
    tags: string = CONTROL_TAGS
): OpeningTag[] {
    const out: OpeningTag[] = [];
    for (const match of source.matchAll(new RegExp(`<(${tags})\\b`, 'g'))) {
        const start = match.index;
        let i = start;
        let depth = 0;
        let quote: string | null = null;
        while (i < source.length) {
            const ch = source[i];
            if (quote !== null) {
                if (ch === '\\') i += 1;
                else if (ch === quote) quote = null;
            } else if (ch === '"' || ch === "'" || ch === '`') {
                quote = ch;
            } else if (ch === '{') depth += 1;
            else if (ch === '}') depth -= 1;
            else if (ch === '>' && depth === 0) break;
            i += 1;
        }
        out.push({ tag: source.slice(start, i + 1), index: start });
    }
    return out;
}

/**
 * 워크 결과 캐시. 가드 9개가 이 함수를 부르고 일부는 한 파일에서 두 번
 * 부르는데, 트리가 2,300개를 넘어 매번 다시 걷는 비용이 실제로 문제가 됐다 —
 * CI 러너에서 스캔 가드 3개가 vitest 기본 5초 타임아웃을 넘겼다(로컬 4.61초로
 * 아슬아슬하게 통과하고 있었다).
 *
 * 테스트 실행 중 트리가 바뀌지 않으므로 캐시가 안전하다.
 */
/**
 * 트리 스캔 가드의 타임아웃.
 *
 * 이 가드들은 유닛 테스트가 아니라 **전 트리 정적 분석**이다 — 2,300개가 넘는
 * 파일을 읽고 정규식을 돌린다. vitest 기본 5초는 그 작업에 맞는 예산이 아니고,
 * 실제로 CI 러너에서 세 개가 한꺼번에 넘쳤다(로컬 4.61초로 아슬아슬하게
 * 통과하고 있었다 — 트리가 커지면 언제든 넘어갈 상태였다).
 *
 * 하나씩 늘리면 다음에 다른 하나가 넘치므로 스캔 가드 전체에 같은 값을 준다.
 * 전역 `testTimeout`을 올리지 않는 이유: 그러면 진짜로 멈춘 테스트가 30초를
 * 기다렸다 실패해 원인 파악이 늦어진다.
 */
export const SCAN_TIMEOUT_MS = 30_000;

const walkCache = new Map<string, string[]>();

export function sourceFiles(
    dir: string,
    extensions = ['.tsx', '.ts']
): string[] {
    const key = `${dir}\u0000${extensions.join(',')}`;
    const cached = walkCache.get(key);
    if (cached !== undefined) return cached;

    const out: string[] = [];
    // `withFileTypes`로 항목마다 `statSync`를 부르지 않는다 — 2,300개 파일에서
    // 시스템 콜 수천 번이 줄어든다.
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            out.push(...sourceFiles(full, extensions));
        } else if (extensions.some(ext => entry.name.endsWith(ext))) {
            out.push(full);
        }
    }
    walkCache.set(key, out);
    return out;
}

/** 클래스를 담는 상수가 아니라 **전달 통로**인 이름들. */
const PASS_THROUGH_NAMES = new Set([
    'className',
    'classNames',
    'classes',
    'cls',
    'cn',
    'clsx',
    'twMerge',
]);

let cached: Set<string> | null = null;

/** 컨트롤 태그의 className 표현식에 등장하는 식별자 이름 전부. */
export function identifiersUsedOnControls(srcDir: string): Set<string> {
    if (cached !== null) return cached;
    const names = new Set<string>();
    for (const file of sourceFiles(srcDir, ['.tsx'])) {
        if (file.includes(`${path.sep}__tests__${path.sep}`)) continue;
        const source = blankComments(readFileSync(file, 'utf8'));
        for (const { tag } of controlOpeningTags(source)) {
            const expr = /className=\{([\s\S]*)$/.exec(tag)?.[1];
            if (expr === undefined) continue;
            // 문자열 리터럴을 걷어낸다 — 안의 낱말이 식별자로 잡히면 `mb`,
            // `text` 같은 게 색인에 들어가 아무거나 컨트롤로 보이게 된다.
            //
            // 단 템플릿 리터럴은 **통째로 버리지 않는다.** `${...}` 안은 코드다.
            // 예전엔 백틱 전체를 지워서 `className={`${CHIP_BASE} ...`}` 형태가
            // 식별자를 하나도 내놓지 않았고, 그렇게 적용된 클래스 상수는 어떤
            // 스캐너에도 안 걸렸다(이 레포에 그 형태가 8개 파일에 있다).
            const withoutStrings = expr
                .replace(/`(?:[^`$\\]|\\.|\$(?!\{))*`/g, ' ')
                .replace(/`|\$\{|\}/g, ' ')
                .replace(/'[^']*'/g, ' ')
                .replace(/"[^"]*"/g, ' ');
            for (const ident of withoutStrings.matchAll(
                /\b([A-Z][A-Z0-9_]*|[A-Za-z_$][\w$]*)\b/g
            )) {
                // 프롭 전달 이름은 색인하지 않는다. 컨트롤이
                // `className={cn(className, …)}`로 받아 넘기는 형태가 흔해서,
                // 이 이름을 넣으면 트리의 **모든** 지역 `const className`이
                // 컨트롤 보유로 잡힌다(장식 `<span>` 뱃지가 그렇게 잡혔다).
                // 전달되는 클래스 자체는 속성 스캐너가 본다.
                if (PASS_THROUGH_NAMES.has(ident[1])) continue;
                names.add(ident[1]);
            }
        }
    }
    cached = names;
    return names;
}
