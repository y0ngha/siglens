import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { blankComments } from './support/sourceScan';

/**
 * heading에 색 클래스가 없으면 `body { color: var(--color-secondary-50) }`을
 * 상속한다 — 램프에서 **가장 밝은** 단계이자 h1이 쓰는 값이다. 그래서 색을
 * 지정하지 않은 h2/h3는 자기를 거느린 h1과 같은 밝기로, 때로는 자기 하위
 * heading보다 어둡게 렌더된다.
 *
 * 이 가드가 필요한 이유는 하나다: **대비 스윕으로는 구조적으로 못 잡는다.**
 * 가장 밝은 색을 상속하면 대비는 항상 통과하기 때문이다. 실제로 225개 요소를
 * 양 테마로 훑은 스윕이 0건을 보고하는 동안에도 결함은 그대로 있었다. 이건
 * 대비 결함이 아니라 위계 결함이라 자기 검출기가 따로 있어야 한다.
 *
 * 리디자인(W6a~W6h)에서 이 형태를 라우트마다 반복해서 찾았다 — 종합 탭 h2 9개,
 * 뉴스 AI 요약 h3 2개, 펀더멘털·재무제표의 파일별 `HEADING_CLASS_NAME` 8개,
 * 옵션 "AI 옵션 분석"의 네 분기, 의회거래 3곳, 공포탐욕 1곳. 전부 같은 원인이다.
 *
 * ## 검출 조건
 *
 * 1. `<h1>`~`<h6>` 태그 **전체**를 잡고 그 안에서 `className="..."`을 찾는다.
 *    `<h2 className=...>`만 매칭하면 `<h2 id={x} className=...>`을 놓친다 —
 *    실제로 이 사각지대 때문에 초기 스캔이 6곳으로 과소집계됐고, 고치니 13곳이었다.
 * 2. 색 토큰이 하나도 없을 것.
 * 3. **직접 텍스트 노드를 가질 것.** 자식 span들이 각자 스타일을 갖는
 *    브레드크럼형 heading은 상속색이 화면에 나타나지 않으므로 대상이 아니다
 *    (`src/app/share/[id]/page.tsx`가 그 경우다).
 *
 * ## `className={...}` 표현식도 본다
 *
 * 처음엔 `className="..."` 리터럴만 봤는데, 실측하니 리터럴 68곳 대 표현식
 * **113곳**이었다 — heading의 62%를 안 보면서 초록이었다는 뜻이고, 하필 이
 * 리디자인이 도입한 `cn(HEADING_SECTION, ...)` 패턴이 전부 그쪽이다. 가드가
 * **잘못된 이유로 통과**하고 있었다.
 *
 * 그래서 표현식일 때는 그 안에 색 토큰 문자열이 있거나, **색을 품은 것으로
 * 확인된 식별자**(`typographyStyles.ts`에서 값에 색 토큰이 들어간 상수)를
 * 참조하는지 본다. 식별자 목록은 하드코딩하지 않고 그 파일을 읽어 만든다 —
 * 새 토큰이 생겨도 자동으로 따라간다.
 *
 * ## 파일 로컬 상수도 따라간다
 *
 * `className={HEADING_CLASS_NAME}`처럼 같은 파일의 상수를 넘기는 형태는 그
 * 상수 정의를 찾아 값으로 판정한다. `widgets/fundamental/**`와
 * `widgets/financials/**`의 12곳이 이 형태다.
 *
 * ## 끝내 확인할 수 없는 것은 침묵하지 않고 선언시킨다
 *
 * prop으로 받거나(`headingClassName`) 런타임 값(`card.textColor`)이면 정적으로는
 * 알 수 없다. 그런 자리는 `UNVERIFIABLE`에 **근거와 함께** 적어야 하고, 새로
 * 생기면 테스트가 깨진다. 조용히 넘어가면 가드가 다시 "잘못된 이유로 통과"하는
 * 상태로 돌아간다 — 이 파일이 이미 한 번 그랬다.
 */

const SRC_DIR = path.resolve(__dirname, '../..');

/** 색을 명시하는 것으로 인정하는 클래스 조각. */
const COLOUR_MARKERS = [
    'text-secondary-',
    'text-primary-',
    'text-ui-',
    'text-chart-',
    'text-grade',
    'text-white',
    'text-black',
    'sr-only',
];

const HEADING_RE = /<(h[1-6])\b([^>]*)>([\s\S]*?)<\/\1>/g;
const CLASSNAME_LITERAL_RE = /className="([^"]*)"/;
const CLASSNAME_EXPR_RE = /className=\{([\s\S]*?)\}(?=\s|>|$)/;

/**
 * 주석을 지운 소스. 산문에 `<h1>` 같은 조각이 섞여 있으면 `HEADING_RE`의 lazy
 * 매칭이 그 조각을 **뒤에 오는 진짜 heading의 닫는 태그**와 짝지어, 사이에 있는
 * 실제 heading을 통째로 삼킨다. 실측: `src/app/onboarding/page.tsx:38`의 주석
 * 한 줄이 42행의 진짜 h1을 가려 그 파일에서 매칭이 1건만 나왔다.
 */
/**
 * 주석을 **지우지 않고 같은 길이의 공백으로 바꾼다.**
 *
 * 예전엔 삭제했는데, 그러면 이후 모든 오프셋이 앞으로 당겨져 보고되는 줄번호가
 * 실제 위치와 어긋난다 — 감사가 `app/economy/page.tsx:324`의 위반을 `:255`로
 * 보고하는 걸 확인했다(69줄 오차). 가드가 틀린 좌표를 주면 유지보수자는
 * 무관한 코드를 들여다보게 되므로, 지적 자체보다 나쁠 수 있다.
 * 줄바꿈은 그대로 둬야 줄 수가 유지된다.
 */
/**
 * 주석 제거는 공통 스캐너에 맡긴다.
 *
 * 이 파일이 직접 짠 규칙 두 개가 각각 결함이었다. JSX 주석 규칙은 게으른
 * 매칭에 닫는 중괄호 앵커가 붙어, 자기 종료 표시를 지나 멀리 있는 다른
 * 종료 지점까지 삼켰다(heading 8개가 통째로 안 보였다). 줄 주석 규칙은
 * 넓혔다 좁혔다 하며 회귀를 한 번 냈다. 문자열·주석 판별은 한 곳에서만
 * 옳으면 된다.
 */
const stripComments = blankComments;

function tsxFiles(dir: string): string[] {
    const out: string[] = [];
    for (const name of readdirSync(dir)) {
        if (name === 'node_modules' || name === '__tests__') continue;
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) {
            out.push(...tsxFiles(full));
        } else if (name.endsWith('.tsx')) {
            out.push(full);
        }
    }
    return out;
}

/**
 * heading 안에 **직접** 텍스트가 있는지.
 *
 * 자식 태그만 지우면 안 된다 — `<span>A</span>`에서 태그만 벗기면 `A`가 남아
 * 직접 텍스트로 오판한다. 자식 요소를 **내용째** 제거해야 한다. 안쪽부터
 * 짝이 맞는 요소를 반복 제거하고, self-closing 태그도 지운 뒤, JSX 표현식
 * `{...}`은 값이 텍스트일 수 있으므로 문자 하나로 남긴다.
 */
function hasDirectText(inner: string): boolean {
    let rest = inner.replace(/<[^>]*\/>/g, '');
    let previous: string;
    do {
        previous = rest;
        // 가장 안쪽(자식 태그를 포함하지 않는) 요소부터 통째로 제거
        rest = rest.replace(
            /<(\w[\w.-]*)\b[^>]*>((?:(?!<\/?\1[\s>])[\s\S])*)<\/\1>/g,
            ''
        );
    } while (rest !== previous);
    return rest.replace(/\{[^}]*\}/g, 'X').trim().length > 0;
}

/**
 * `typographyStyles.ts`에서 값에 색 토큰이 들어간 export 상수 이름. 이걸
 * 참조하는 `className={...}`은 색을 가진 것으로 본다. 목록을 하드코딩하지 않고
 * 파일에서 읽어 새 토큰을 자동으로 따라간다.
 */
function colourBearingTokens(): Set<string> {
    const source = readFileSync(
        path.join(SRC_DIR, 'shared/lib/typographyStyles.ts'),
        'utf8'
    );
    const names = new Set<string>();
    for (const match of source.matchAll(
        /export const (\w+)\s*=\s*cn\(([\s\S]*?)\);/g
    )) {
        if (COLOUR_MARKERS.some(marker => match[2].includes(marker))) {
            names.add(match[1]);
        }
    }
    return names;
}

/**
 * 정적으로 색을 판정할 수 없는 자리. 근거를 함께 적는다.
 * 새 항목이 생기면 테스트가 깨지므로 반드시 판단을 거친다.
 */
const UNVERIFIABLE: ReadonlySet<string> = new Set([
    // 호출부가 색을 넘긴다. 실제 호출부는 모두 `HEADING_CLASS_NAME`
    // (= `cn('mb-4', HEADING_SECTION)`)을 전달한다.
    'widgets/fundamental/sections/EmptySectionCard.tsx::headingClassName',
    // 카테고리별 색을 데이터에서 받는다(`card.textColor`). 카드 정의가
    // 색을 소유하므로 이 자리에서는 판정 대상이 아니다.
    'widgets/home/ui/CategoryCardGrid.tsx::card',
]);

/** `const NAME = ...` 값을 소스에서 찾아 돌려준다. */
function constantValue(source: string, name: string): string | null {
    const re = new RegExp(
        `const\\s+${name}\\s*(?::[^=]*)?=\\s*([\\s\\S]*?);\\s*\\n`,
        ''
    );
    return re.exec(source)?.[1] ?? null;
}

/**
 * 상수 값을 찾는다. 같은 파일에 없으면 **상대 경로 import를 한 단계 따라간다** —
 * `widgets/financials/sections/*`가 `./constants`의 `HEADING_CLASS_NAME`을
 * 가져다 쓰는 형태가 그 경우다. 한 단계만 따라가는 건 의도적이다: 더 깊이
 * 들어가면 이 가드 자체가 사실상 번들러가 되고, 그만큼 조용히 틀릴 여지가 는다.
 */
function resolveConstant(
    source: string,
    file: string,
    name: string
): string | null {
    const own = constantValue(source, name);
    if (own !== null) return own;

    const importRe = new RegExp(
        `import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*'(\\.[^']*)'`
    );
    const from = importRe.exec(source)?.[1];
    if (from === undefined) return null;

    const base = path.resolve(path.dirname(file), from);
    for (const candidate of [
        `${base}.ts`,
        `${base}.tsx`,
        path.join(base, 'index.ts'),
    ]) {
        try {
            return constantValue(readFileSync(candidate, 'utf8'), name);
        } catch {
            // 다음 후보
        }
    }
    return null;
}

function findColourlessHeadings(): {
    offenders: string[];
    unverifiable: string[];
} {
    const tokens = colourBearingTokens();
    const offenders: string[] = [];
    const unverifiable: string[] = [];
    for (const file of tsxFiles(SRC_DIR)) {
        const source = stripComments(readFileSync(file, 'utf8'));
        for (const match of source.matchAll(HEADING_RE)) {
            const [, tag, attrs, inner] = match;
            if (!hasDirectText(inner)) continue;

            const literal = CLASSNAME_LITERAL_RE.exec(attrs);
            const expr =
                literal === null ? CLASSNAME_EXPR_RE.exec(attrs) : null;
            const value = literal?.[1] ?? expr?.[1];
            // className이 아예 없는 heading(예: sr-only 섹션 안의 맨 태그)은
            // 색을 주장하지 않으므로 대상이 아니다.
            if (value === undefined) continue;

            const carriesColour = (text: string): boolean =>
                COLOUR_MARKERS.some(marker => text.includes(marker)) ||
                [...tokens].some(name =>
                    new RegExp(`\\b${name}\\b`).test(text)
                );

            if (carriesColour(value)) continue;

            const rel = path.relative(SRC_DIR, file);
            const line = source.slice(0, match.index).split('\n').length;

            // 표현식이면 참조하는 식별자를 뽑아 한 단계 따라간다.
            // **문자열 리터럴을 먼저 걷어낸다** — 안 그러면 `'mb-3 text-balance'`의
            // `mb`·`text` 같은 클래스 조각이 식별자로 잡혀 전부 미해석으로 샌다.
            const withoutStrings = value.replace(
                /'[^']*'|"[^"]*"|`[^`]*`/g,
                ''
            );
            const identifiers = [
                ...withoutStrings.matchAll(/\b([A-Za-z_$][\w$]*)\b/g),
            ].map(m => m[1]);
            const resolved = identifiers
                .map(name => resolveConstant(source, file, name))
                .filter((v): v is string => v !== null);
            if (resolved.some(carriesColour)) continue;

            // 여기까지 왔는데 **해석되지 않은** 식별자가 남아 있으면 정적 판정 불가다.
            // `cn`처럼 값이 전부 보이는 호출(인자가 죄다 리터럴)은 판정 가능하므로
            // unverifiable로 새면 안 된다 — 그러면 진짜 결함이 "실패"가 아니라
            // "목록이 바뀜"으로만 드러나 가드가 무뎌진다.
            const unresolved = identifiers.filter(
                name =>
                    name !== 'cn' &&
                    !tokens.has(name) &&
                    resolveConstant(source, file, name) === null
            );
            if (literal === null && unresolved.length > 0) {
                unverifiable.push(`${rel}::${unresolved[0]}`);
                continue;
            }

            offenders.push(
                `${rel}:${line} <${tag}> "${value.replace(/\s+/g, ' ').trim()}"`
            );
        }
    }
    return {
        offenders: offenders.sort(),
        unverifiable: [...new Set(unverifiable)].sort(),
    };
}

describe('heading colour token guard', () => {
    it('직접 텍스트를 가진 heading은 색 토큰을 명시한다', () => {
        expect(findColourlessHeadings().offenders).toEqual([]);
    });

    it('정적으로 판정할 수 없는 자리는 근거와 함께 선언돼 있다', () => {
        expect(findColourlessHeadings().unverifiable).toEqual(
            [...UNVERIFIABLE].sort()
        );
    });

    it('검출기 자체가 동작한다 — 색 없는 heading을 실제로 잡는다', () => {
        const source =
            '<h2 id={x} className="mb-2 text-lg font-semibold">제목</h2>';
        const match = [...source.matchAll(HEADING_RE)][0];
        expect(match).toBeDefined();
        const className = CLASSNAME_LITERAL_RE.exec(match[2]);
        expect(className?.[1]).toBe('mb-2 text-lg font-semibold');
        expect(
            COLOUR_MARKERS.some(marker => className![1].includes(marker))
        ).toBe(false);
        expect(hasDirectText(match[3])).toBe(true);
    });

    it('className이 첫 속성이 아니어도 잡는다 — 초기 스캔이 놓쳤던 사각지대', () => {
        const source = '<h2 id={headingId} className="text-lg">제목</h2>';
        const match = [...source.matchAll(HEADING_RE)][0];
        expect(CLASSNAME_LITERAL_RE.exec(match[2])?.[1]).toBe('text-lg');
    });

    it('직접 텍스트가 없는 heading은 대상이 아니다', () => {
        const source =
            '<h1 className="flex gap-2"><span className="text-lg">A</span></h1>';
        const match = [...source.matchAll(HEADING_RE)][0];
        expect(hasDirectText(match[3])).toBe(false);
    });
});
