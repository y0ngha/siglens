import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * 조작 요소(`button`/`a`/`input`/`textarea`/`select`)의 **자기 보더**는
 * `--color-border-control`을 써야 한다.
 *
 * WCAG 1.4.11은 "사용자 인터페이스 구성요소를 식별하는 데 필요한 시각 정보"에
 * 3:1을 요구한다. 장식용 `secondary-600`/`secondary-700`은 라이트에서 약 1.15~1.50:1이라,
 * 채움이 페이지 배경과 구분되지 않는 아웃라인 컨트롤은 **경계가 유일한 식별 수단인데
 * 그게 안 보인다**. 실측 예: 재분석 버튼 1.41, 만기 선택 칩 1.50, 문의 폼 입력 1.23.
 * `border-control`은 정확히 이 용도로 만든 토큰이다(다크 3.57 / 라이트 3.30).
 *
 * `globals.css`의 정책 주석대로, **장식용 카드 보더는 이 규칙의 대상이 아니다** —
 * 이 가드가 요소 종류로 한정하는 이유다. 카드·패널·툴팁 컨테이너는 걸리지 않는다.
 *
 * ## 이 가드가 검사하지 않는 것
 *
 * - `hover:border-*` 같은 **상태 변화**는 무시한다(기본 보더만 본다). 호버는
 *   기본 상태가 이미 식별 가능할 때의 피드백이다.
 * - 모듈 상수에 담아 `className={SOME_CONSTANT}`로 넘기는 형태는 요소 태그와
 *   짝지을 수 없다. 그래서 아래 `findConstantHeldBorders`가 **상수 정의 자체**를 따로
 *   훑는다 — 처음엔 이걸 주석으로만 적어두었는데, 실제로 그 사각지대가 결함 5개를
 *   숨기고 있었다(헤더 검색 입력 1.16:1 포함). 한계를 아는 것과 막는 것은 다르다.
 * - 아이콘만 있는 버튼은 아이콘 자체가 3:1을 넘으면 1.4.11을 만족하므로
 *   원칙적으로 예외지만, 같은 화면의 다른 컨트롤과 어긋나 보이는 문제가 있어
 *   리디자인에서는 함께 `border-control`로 맞췄다. 예외를 다시 두고 싶으면
 *   `ALLOWED_CONSTANTS`에 **상수 단위로** 추가하고 왜 식별 가능한지 함께 적을 것.
 * - 상수가 조작 요소가 아닌 태그(`<div>` 등)에만 쓰이면 대상이 아니다 —
 *   컨테이너 보더는 `globals.css` 정책상 장식이다.
 */

const SRC_DIR = path.resolve(__dirname, '../..');

// `Link`는 next/link — 실제로는 `<a>`로 렌더되는 이 레포의 주된 내비게이션
// 컨트롤이다(52파일이 import). 처음엔 HTML 태그 이름만 넣었는데, 그 사각지대에
// 살아 있는 결함 3개가 있었다: 계정 삭제의 "취소"(바로 위 `<input>`은 이번에
// 고쳤으면서 이건 놓쳤다), 계정 페이지의 버튼형 링크, 관련 종목 칩.
//
// 한계: `<Link`를 **문자열로** 찾는다. 모듈을 따라가지 않으므로, 지역에 같은
// 이름의 컴포넌트를 정의하거나 주석에 `<Link ...>` 예시 마크업을 적으면
// 그대로 휩쓸린다. 지금은 둘 다 0건(확인함)이고 `\b`가 `<LinkedInIcon>` 같은
// 근접어는 걸러낸다.
const CONTROL_TAGS = 'button|a|input|textarea|select|Link';
const CONTROL_RE = new RegExp(`<(${CONTROL_TAGS})\\b([^>]*)>`, 'gs');
const CLASSNAME_RE = /className="([^"]*)"/;
// 컨트롤 보더 판정은 **금지 목록이 아니라 허용 목록**이다.
//
// 처음엔 마이그레이션 대상이던 `border-secondary-(600|700)` 두 개만 열거했는데,
// 감사가 뮤테이션으로 구멍을 증명했다: 컨트롤 보더를 `border-secondary-800`으로
// 바꿔도 가드가 초록이었다. 그 토큰은 **라이트에서 `#fff`**라 흰 카드 위에서
// 1.00:1 — 경계가 아예 사라진다. 열거식은 "내가 아는 나쁜 값"만 막고 나머지는
// 전부 통과시키므로, 새 토큰이 생길 때마다 조용히 뚫린다.
//
// 방향 보더(`border-t-*` 등)는 제외한다. 그건 구분선이지 컨트롤의 경계가 아니다.
const BORDER_COLOUR_RE =
    /^border-(?![trblxy]-)(?!\d+$)(?!(?:solid|dashed|dotted|double|none|hidden|collapse|separate)$)(.+)$/;

/**
 * 컨트롤 경계로 허용되는 색. 나머지는 전부 검출 대상이다.
 *
 * `secondary-500`이 여기 있는 이유: 동의 체크박스가 `appearance-none
 * bg-transparent`라 보더가 유일한 식별 수단인데, 이 토큰은 다크 6.53~7.01,
 * 라이트 5.91~6.73으로 3:1을 크게 넘는다(표면 램프 950/900/800 기준 실측).
 * `border-control`(3.34~3.83)로 낮추는 건 개선이 아니라 하향이다.
 */
//
// **알파 틴트(`/20` 등)는 허용하지 않는다.** 처음엔 `ui-*`·`primary-*`·`chart-*`에
// `(?:\/\d+)?`를 붙여뒀는데, 감사가 그 구멍으로 `border-ui-danger/20`(라이트에서
// 인셋 위 약 1.3:1)과 `border-primary-950/10`(약 1.0:1)을 통과시켰다. 열거식을
// 허용식으로 바꾸면서 한쪽 구멍을 막고 다른 쪽을 연 셈이었다. 색이 무엇이든
// 20%만 남기면 경계가 사라진다 — 틴트가 필요하면 3:1을 실측하고 여기에
// 근거와 함께 명시적으로 추가할 것.
const ALLOWED_BORDER_COLOUR_RE =
    /^(?:border-control|secondary-500|primary-\d{2,3}|ui-[a-z]+(?:-text)?|chart-[a-z]+|transparent|current|inherit)$/;

function isDecorativeBorder(token: string): boolean {
    const match = BORDER_COLOUR_RE.exec(token);
    if (match === null) return false;
    return !ALLOWED_BORDER_COLOUR_RE.test(match[1]);
}

/**
 * 주석은 토큰화 전에 걷어낸다. `cn(...)` 안에는 근거 주석이 흔한데, 거기
 * 적힌 `border-control`·`border-box` 같은 **낱말**이 클래스로 잡혀 없는
 * 위반을 만든다(실제로 ReasoningToggle에서 3건이 그렇게 잡혔다).
 */
function stripInlineComments(value: string): string {
    // 줄 **끝**에 붙은 `//` 주석도 지운다. 줄 맨 앞만 지우던 때는 `cn(...)`
    // 안의 후행 주석에 적힌 클래스 이름이 그대로 위반으로 잡혔다 — 감사가
    // `// was border-secondary-600`을 덧붙여 50줄 떨어진 자리에 없는 위반을
    // 만들어 증명했다. `https://`는 `:` 뒤라 아래 문자 클래스에 안 걸린다.
    return value
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[\s,(){}])\/\/[^\n]*/g, '$1');
}

/**
 * 근거를 적은 예외만 여기 둔다. **상수 단위**로 적는다 — 파일 단위로 면제하면
 * 그 파일의 다른 컨트롤까지 통째로 빠져나가 가드에 구멍이 생긴다.
 * 항목을 추가하려면 그 컨트롤이 보더 없이 무엇으로 식별되는지 함께 적을 것.
 */
const ALLOWED_CONSTANTS: ReadonlySet<string> = new Set([]);

/**
 * 요소 스캐너의 예외. `파일:줄` 단위이며 근거를 함께 적는다.
 * 비어 있는 게 정상이다.
 */
const ALLOWED_ELEMENTS: ReadonlySet<string> = new Set([
    // 리포트 복사 버튼. `disabled` 분기(`showProgress || isAnalyzing`)만
    // `border-secondary-700`을 쓰며, WCAG 1.4.11은 비활성 컨트롤을 면제한다.
    //
    // 이 예외는 **여는 태그 전체**를 면제한다는 점을 알고 둔다. 처음 넣었을 때
    // 근거 주석에 "활성 분기는 다른 색을 쓴다"고 적었는데 사실이 아니었다 —
    // `copied`/`failed`만 그랬고 평상시 기본 상태인 `idle`은 여전히 장식 보더였다.
    // 그 잘못된 주석이 살아 있는 결함을 가렸다. 지금은 `idle`도 `border-control`이며,
    // 이 자리에 분기를 추가할 때는 이 예외가 그것까지 덮는다는 걸 반드시 확인할 것.
    'widgets/analysis/AnalysisPanel.tsx:1012',

    // 드롭다운 메뉴의 첫 항목. `border-b`는 이 항목과 아래 지역 목록을 가르는
    // **구분선**이고, 컨트롤 자체의 경계는 패널의 보더 + 상태 채움
    // (`bg-secondary-800`, hover 포함)이 맡는다.
    //
    // 방향 보더를 일괄로 봐주는 휴리스틱을 넣었다가 걷어냈다. 감사가 밑줄형
    // 입력(`border-b`가 경계의 전부, 라이트 1.05:1)을 그 예외로 통과시켰기
    // 때문이다. 소스만 봐서는 "항목 사이 줄"과 "요소의 유일한 경계"를 가를 수
    // 없으므로, 휴리스틱 대신 이렇게 자리마다 판단을 적는다.
    'widgets/layout/HeaderNavMenu.tsx:147',

    // 아래 둘은 **카드 표면**이다. 링크이긴 하지만 제목·설명·시세 블록을 담은
    // 면이고, 보더는 그 면의 장식이지 컨트롤의 경계 표시가 아니다.
    // globals.css의 `--color-border-control` 정책 주석에 적힌 "카드·패널의
    // 장식 보더는 제외" 항목이 그대로 적용된다. 칩(rounded-full, 내용이 텍스트
    // 한 줄)은 보더가 곧 경계라서 이 예외에 들지 않는다 — RelatedSymbols와
    // CategoryCardGrid의 칩은 `border-control`로 고쳤다.
    'widgets/dashboard/SignalStockCard.tsx:22',
]);

function tsxFiles(dir: string): string[] {
    const out: string[] = [];
    for (const name of readdirSync(dir)) {
        if (name === 'node_modules' || name === '__tests__') continue;
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) {
            out.push(...tsxFiles(full));
        } else if (name.endsWith('.tsx') || name.endsWith('.ts')) {
            // `.ts`도 훑는다 — 클래스 문자열 모듈(`shared/lib/*Styles.ts`)이
            // 여기 산다. 요소 스캐너는 `.ts`에 컨트롤 태그가 없어 영향이 없고,
            // 상수 스캐너만 새로 대상을 얻는다.
            out.push(full);
        }
    }
    return out;
}

/**
 * 모듈 상수에 담긴 컨트롤 클래스.
 *
 * 처음엔 상수 **이름**으로 골랐다(INPUT/BUTTON/FIELD/…). 그건 휴리스틱이라
 * `TOGGLE_CLASS`나 `CTA_CLASS` 같은 새 이름이 생기면 조용히 빠져나간다. 지금은
 * **사용처**로 판정한다 — 그 상수가 실제로 조작 요소 태그의 `className`에
 * 들어가는지 본다. 이름이 무엇이든 상관없고, 반대로 이름이 그럴듯해도 `<div>`에만
 * 쓰이면 대상이 아니다(`HoldingForm`의 `SYMBOL_CHIP`이 그 경우다).
 */
// 초기화식 **전체**를 잡는다(따옴표 리터럴, 템플릿, `cn(...)` 본문 모두).
// 예전엔 `const X = '…'` 한 형태만 매칭했는데, 이 브랜치가 새로 만든
// `surfaceStyles.ts`·`typographyStyles.ts`가 정확히 `.ts` + `cn()` 스타일이라
// **브랜치 자기 컨벤션을 따르면 자기 가드를 우회**하는 상태였다. 감사가
// `CHIP_INACTIVE`를 `cn('border-secondary-600 …')`로 바꿔 통과시켜 증명했다.
const CONST_DECL_HEAD_RE =
    /(?:export\s+)?const\s+(\w+)(?:\s*:[^=]*)?\s*=\s*(?='|`|cn\()/g;

/**
 * 초기화식을 **괄호·따옴표 균형을 세어** 끝까지 읽는다.
 *
 * 예전엔 `cn\([\s\S]*?\)`로 잡았는데 첫 `)`에서 잘렸다. 그래서
 * `cn('bg-…', String(1), 'border-secondary-700 …')`처럼 중간에 호출이 하나만
 * 끼어도 뒤쪽 인자가 통째로 안 보였다 — 감사가 그대로 통과시켜 증명했다.
 * 라운드 1에서 이 정규식을 넓혔지만 절반만 닫혀 있었던 셈이다.
 */
function initialiserAt(source: string, start: number): string {
    let depth = 0;
    let quote: string | null = null;
    for (let i = start; i < source.length; i += 1) {
        const ch = source[i];
        if (quote !== null) {
            if (ch === '\\') i += 1;
            else if (ch === quote) quote = null;
            continue;
        }
        if (ch === "'" || ch === '"' || ch === '`') {
            quote = ch;
            if (depth === 0 && i > start) break;
            continue;
        }
        if (ch === '(') depth += 1;
        else if (ch === ')') {
            depth -= 1;
            if (depth === 0) return source.slice(start, i + 1);
        } else if (depth === 0 && (ch === ';' || ch === '\n')) {
            const chunk = source.slice(start, i);
            if (/^\s*['`]/.test(chunk)) return chunk;
        }
    }
    return source.slice(start, source.indexOf('\n', start) + 1 || undefined);
}

/**
 * 그 상수가 조작 요소 태그의 className으로 쓰이는가.
 *
 * `CONTROL_RE`가 잡은 속성 문자열만 보면 안 된다 — `className={cn(\n  INPUT_BASE,\n …)}`
 * 처럼 **여러 줄에 걸친** 표현식은 `[^>]*`가 첫 `>`에서 끊겨 상수 이름에 닿지 못한다.
 * 실측으로 확인했다: 이름만 바꾼 뮤테이션이 통과해버렸다.
 *
 * 그래서 태그 시작 위치부터 그 요소가 닫히는 지점까지의 **원문 구간**을 잘라
 * 그 안에서 찾는다. 닫는 지점은 여는 태그의 중괄호 균형이 맞고 `>`를 만나는 곳이다.
 */
/**
 * 여는 태그 원문을 잘라 돌려준다.
 *
 * 중괄호 균형만 보면 부족하다 — `title="A > B"`처럼 **문자열 안의 `>`**가
 * 태그를 조기에 끊어 `className`에 닿지 못한다. 따옴표 안에서는 `>`를 무시한다.
 * 이 파일은 같은 종류의 구멍(여러 줄 표현식)을 이미 한 번 막았고, 그때 중괄호만
 * 처리하고 따옴표를 빼먹어 구멍이 하나 남아 있었다.
 */
function openingTagAt(source: string, start: number): string {
    let depth = 0;
    let quote: string | null = null;
    for (let i = start; i < source.length; i += 1) {
        const ch = source[i];
        if (quote !== null) {
            if (ch === quote && source[i - 1] !== '\\') quote = null;
            continue;
        }
        if (ch === '"' || ch === "'" || ch === '`') quote = ch;
        else if (ch === '{') depth += 1;
        else if (ch === '}') depth -= 1;
        else if (ch === '>' && depth === 0) return source.slice(start, i);
    }
    return source.slice(start);
}

function controlOpeningTags(source: string): { tag: string; index: number }[] {
    const out: { tag: string; index: number }[] = [];
    for (const match of source.matchAll(
        new RegExp(`<(?:${CONTROL_TAGS})\\b`, 'g')
    )) {
        out.push({
            tag: openingTagAt(source, match.index),
            index: match.index,
        });
    }
    return out;
}

function usedOnControlTag(source: string, name: string): boolean {
    const nameRe = new RegExp(`\\b${name}\\b`);
    return controlOpeningTags(source).some(
        ({ tag }) => /className=\{/.test(tag) && nameRe.test(tag)
    );
}

function findConstantHeldBorders(
    allowed: ReadonlySet<string> = ALLOWED_CONSTANTS
): string[] {
    const offenders: string[] = [];
    for (const file of tsxFiles(SRC_DIR)) {
        const source = readFileSync(file, 'utf8');
        for (const match of source.matchAll(CONST_DECL_HEAD_RE)) {
            const name = match[1];
            const classes = initialiserAt(
                source,
                match.index + match[0].length
            );
            if (!usedOnControlTag(source, name)) continue;
            const tokens = stripInlineComments(classes).split(/[\s'"`,]+/);
            const bare = tokens.filter(isDecorativeBorder);
            if (bare.length === 0) continue;
            const rel = path.relative(SRC_DIR, file);
            if (allowed.has(`${rel}::${name}`)) continue;
            const line = source.slice(0, match.index).split('\n').length;
            offenders.push(`${rel}:${line} const ${name} ${bare.join(' ')}`);
        }
    }
    return offenders.sort();
}

function findDecorativeControlBorders(
    allowed: ReadonlySet<string> = ALLOWED_ELEMENTS
): string[] {
    const offenders: string[] = [];
    for (const file of tsxFiles(SRC_DIR)) {
        const source = readFileSync(file, 'utf8');
        for (const { tag, index } of controlOpeningTags(source)) {
            // 리터럴이든 표현식이든 className 전체를 본다.
            const value =
                CLASSNAME_RE.exec(tag)?.[1] ??
                /className=\{([\s\S]*)$/.exec(tag)?.[1];
            if (value === undefined) continue;
            const tokens = stripInlineComments(value).split(/[\s'"`,]+/);
            const bare = tokens.filter(isDecorativeBorder);
            if (bare.length === 0) continue;
            const rel = path.relative(SRC_DIR, file);
            const line = source.slice(0, index).split('\n').length;
            if (allowed.has(`${rel}:${line}`)) continue;
            offenders.push(`${rel}:${line} ${bare.join(' ')}`);
        }
    }
    return offenders.sort();
}

/**
 * 기본 보더가 `border-control`인데 hover가 장식색으로 내려가는 자리.
 * 호버는 강조여야 하는데 이러면 **호버할 때 오히려 덜 보인다**(3.57 → 1.69).
 * 이 가드가 hover를 기본적으로 무시하기 때문에 구조적으로 안 보이던 형태라,
 * 이 조합만 따로 잡는다. 실제로 이 리팩터링에서 네 곳이 이 상태였고, 그중 둘은
 * 내 재확인 grep이 base와 hover가 다른 줄에 있어서 놓쳤다.
 */
function findHoverContrastDrops(): string[] {
    const offenders: string[] = [];
    for (const file of tsxFiles(SRC_DIR)) {
        const source = readFileSync(file, 'utf8');
        for (const match of source.matchAll(
            /className=(?:"([^"]*)"|\{([\s\S]*?)\}(?=\s|>))/g
        )) {
            const value = match[1] ?? match[2] ?? '';
            if (!value.includes('border-border-control')) continue;
            // 예전엔 여기만 옛 열거(`600|700`)를 그대로 들고 있었다. 그래서
            // `hover:border-secondary-800`(라이트에서 `#fff` — 호버하면 보더가
            // 아예 사라진다)이 통과했다. 본 규칙과 같은 판정을 쓴다.
            const hoverTokens = stripInlineComments(value)
                .split(/[\s'"`,]+/)
                .filter(x => x.startsWith('hover:border-'))
                .map(x => x.slice('hover:'.length));
            if (!hoverTokens.some(isDecorativeBorder)) continue;
            const rel = path.relative(SRC_DIR, file);
            const line = source.slice(0, match.index).split('\n').length;
            offenders.push(`${rel}:${line}`);
        }
    }
    return offenders.sort();
}

describe('control border token guard', () => {
    it('조작 요소의 기본 보더는 border-control을 쓴다', () => {
        expect(findDecorativeControlBorders()).toEqual([]);
    });

    it('상수에 담은 컨트롤 보더도 border-control을 쓴다', () => {
        expect(findConstantHeldBorders()).toEqual([]);
    });

    // `파일:줄` 키는 그 줄이 움직이면 조용히 빗나간다 — 아무것도 면제하지 않거나,
    // 더 나쁘게는 **다른 요소**를 면제한다. 어느 쪽이든 가드는 초록이라 신호가 없다.
    // 그래서 예외 하나하나가 지금도 실제 검출 대상에 맞는지 함께 단언한다.
    it('예외 목록에 낡은 항목이 없다', () => {
        const rawElements = new Set(
            findDecorativeControlBorders(new Set()).map(o => o.split(' ')[0])
        );
        for (const key of ALLOWED_ELEMENTS) {
            expect(rawElements, `면제 대상이 사라짐: ${key}`).toContain(key);
        }
        const rawConstants = new Set(
            findConstantHeldBorders(new Set()).map(o => {
                const [loc, , name] = o.split(' ');
                return `${loc.split(':')[0]}::${name}`;
            })
        );
        for (const key of ALLOWED_CONSTANTS) {
            expect(rawConstants, `면제 대상이 사라짐: ${key}`).toContain(key);
        }
    });

    it('hover가 기본 보더보다 대비를 낮추지 않는다', () => {
        expect(findHoverContrastDrops()).toEqual([]);
    });

    it('검출기가 실제로 잡는다', () => {
        const source =
            '<button type="button" className="rounded border border-secondary-700 px-4">닫기</button>';
        const match = [...source.matchAll(CONTROL_RE)][0];
        const className = CLASSNAME_RE.exec(match[2]);
        const bare = className![1].split(/\s+/).filter(isDecorativeBorder);
        expect(bare).toEqual(['border-secondary-700']);
    });

    it('hover 상태 변화는 대상이 아니다 — 기본 보더만 본다', () => {
        const source =
            '<button className="border border-border-control hover:border-secondary-600">x</button>';
        const match = [...source.matchAll(CONTROL_RE)][0];
        const bare = CLASSNAME_RE.exec(match[2])![1]
            .split(/\s+/)
            .filter(isDecorativeBorder);
        expect(bare).toEqual([]);
    });

    it('카드·패널의 장식 보더는 대상이 아니다 — 요소 종류로 한정한다', () => {
        const source =
            '<div className="rounded-lg border border-secondary-700 p-6">카드</div>';
        expect([...source.matchAll(CONTROL_RE)]).toHaveLength(0);
    });
});
