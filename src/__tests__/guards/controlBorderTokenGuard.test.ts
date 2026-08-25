import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    CONTROL_TAGS,
    controlOpeningTags,
    identifiersUsedOnControls,
    sourceFiles,
} from './support/controlUsage';
import {
    blankComments,
    classTokens,
    readInitialiser,
    stripVariants,
} from './support/sourceScan';
import {
    MIN_RATIO,
    minContrastOverSurfaces,
    type Fill,
} from './support/tokenContrast';

/**
 * 조작 요소(`button`/`a`/`input`/`textarea`/`select`/`Link`)의 **경계**는 3:1을
 * 넘는 색이어야 한다.
 *
 * WCAG 1.4.11은 "사용자 인터페이스 구성요소를 식별하는 데 필요한 시각 정보"에
 * 3:1을 요구한다. 채움이 페이지 배경과 구분되지 않는 아웃라인 컨트롤은 경계가
 * 유일한 식별 수단인데, 장식용 `secondary-600/700`은 라이트에서 1.15~1.50:1이라
 * 사실상 안 보인다(실측: 재분석 버튼 1.41, 만기 칩 1.50, 문의 폼 입력 1.23).
 *
 * `globals.css` 정책대로 **카드·패널의 장식 보더는 대상이 아니다** — 그래서
 * 요소 종류로 한정한다.
 *
 * ## 판정을 이름이 아니라 값으로 하는 이유
 *
 * 허용 목록을 `primary-*`·`chart-*` 같은 계열 와일드카드로 적어뒀더니 같은
 * 계열 안에서 3:1을 한참 밑도는 토큰 10종이 통과했다(`primary-950` 1.02,
 * `chart-signal` 1.88 …). 계열은 대비를 보장하지 않는다. 지금은 globals.css의
 * 실제 값으로 표면 램프 × 양 테마 최솟값을 재서 판정한다
 * (`support/tokenContrast`). 알파 틴트도 표면 위에 합성해 같은 잣대로 잰다.
 *
 * ## 무엇을 훑는가
 *
 * 세 갈래를 모두 본다. 감사 네 라운드 동안 매번 "그 형태는 안 보고 있었다"가
 * 결함의 원인이었다.
 *
 * 1. 컨트롤 여는 태그의 className (인라인)
 * 2. 클래스 상수 — **파일 경계를 넘어** 컨트롤에 쓰이는지 색인으로 확인한다.
 *    같은 파일 안에서만 찾던 때는 JSX가 없는 `shared/lib/*Styles.ts`의 상수가
 *    어디에 쓰이든 감시 밖이었다.
 * 3. 이름이 컨트롤을 가리키는 객체 속성(`buttonClassName`, `submitButtonClassName` …)
 *
 * 세 갈래 모두 **같은 리더**(`support/sourceScan`)로 값을 읽는다. 예전엔 각자
 * 정규식을 들고 있다가, 새로 만든 쪽이 이미 고친 버그(게으른 `cn(` 캡처)를
 * 그대로 재현했다.
 */

const SRC_DIR = path.resolve(__dirname, '../..');

/** 방향 세그먼트. 논리 속성(`s`/`e`)까지 — 빼두면 `border-e-2`의 두께가 색으로 읽힌다. */
const DIRECTION = /^(?:[trbl]|[xy]|[se])$/;

const BORDER_STYLE = new Set([
    'solid',
    'dashed',
    'dotted',
    'double',
    'none',
    'hidden',
    'collapse',
    'separate',
]);

const NON_COLOUR = new Set(['transparent', 'current', 'inherit']);

/**
 * 토큰에서 **색 부분만** 뽑는다. `null`이면 색이 아니다(두께·스타일·방향만).
 *
 * `ring-*`도 함께 본다 — 시각적으로 보더와 같은 경계를 그리는데 한동안
 * `border-*`만 봤고, 실제로 소셜 로그인 버튼이 링을 유일한 경계로 쓴다.
 */
export function borderColourPart(token: string): string | null {
    // 정지 경계를 **대체하는** 상태 변형만 벗긴다. 예전엔 `hover:`가 붙으면
    // `null`이라 호버를 인라인 전용 스캐너 하나만 보고 있었고, 같은 토큰을
    // 클래스 상수로 옮기면 빠져나갔다 — 이 브랜치의 리팩터링 방향이 바로 그
    // 이동이었다.
    //
    // `focus` 계열은 **제외한다.** 그건 경계가 아니라 포커스 표시이고
    // (WCAG 2.4.11/2.4.13), 보통 정지 보더 위에 겹쳐 그려진다. 여기 넣으면
    // 정상적인 반투명 포커스 링 7개가 위반으로 잡힌다.
    // 변형 제거는 공용 구현을 쓴다(`support/sourceScan`). 두 가드가 각자
    // 들고 있다가 한쪽만 고쳐진 적이 있고, 임의 변형(`[&:hover]:`)과 이름 붙은
    // group/peer(`group-hover/tog:`), 대괄호 안 콜론(`data-[state=open]:`)이
    // 각각 다른 시점에 구멍이 됐다.
    const { bare, variants, unknown } = stripVariants(token);
    // 포커스 계열은 경계가 아니라 포커스 표시(2.4.11/2.4.13)라 대상이 아니고,
    // 비활성은 1.4.11이 명시적으로 면제한다.
    if (
        variants.some(v =>
            /^(?:focus|focus-visible|focus-within|peer-focus|group-focus|disabled)$/.test(
                v
            )
        )
    ) {
        return null;
    }
    const m = /^(border|ring)(?:-([a-z]{1,2})\b)?(?:-(.+))?$/.exec(bare);
    if (m === null) return null;
    const head = m[2];
    const rest = m[3];
    const tail =
        head !== undefined && !DIRECTION.test(head)
            ? [head, rest].filter(x => x !== undefined && x !== '').join('-')
            : rest;
    if (tail === undefined || tail === '') return null;
    if (/^\d+$/.test(tail)) return null;
    if (BORDER_STYLE.has(tail)) return null;
    if (m[1] === 'ring' && (tail === 'inset' || tail.startsWith('offset-'))) {
        return null;
    }
    // **색이라고 확정된 뒤에** 모르는 변형을 문제 삼는다. 앞에서 던졌더니
    // `file:border-0`(폭)이나 `before:border-…`처럼 이미 레포에 있는 코어
    // 변형까지 터졌다 — 판정 대상이 아닌 토큰에 대해 실패를 내는 건 오탐이다.
    if (unknown.length > 0) {
        throw new Error(
            `${token}: 모르는 변형 프리픽스 "${unknown.join(', ')}" — 판정할 수 없다. 알려진 상태면 support/sourceScan의 목록에 추가할 것`
        );
    }
    return tail;
}

/**
 * 요소가 어떤 면 위에 앉는가. 자기 채움이 고정 흰색이면 그 위에서 재야 한다 —
 * 구글 브랜드 버튼은 두 테마 모두 `bg-white`라, 램프 기준으로 재면 다크 토큰이
 * 통과해 놓고 실제로는 흰 배경에서 2.26:1이 된다.
 */
function fillOf(tokens: string[], file?: string): Fill {
    if (tokens.some(t => /^bg-(white|fixed-|brand-)/.test(t)))
        return 'fixed-white';
    // 채움과 보더가 **다른 스캐너에 걸리는** 경우가 있다 — 채움은 객체 속성에,
    // 보더는 요소에 있는 식(구글 로그인 버튼이 그 형태다). 그러면 요소 스캐너는
    // `bg-`를 못 보고 램프로 판정하는데, 그건 모든 램프 토큰에 관대한 방향이다
    // (실제로 흰 버튼 위 2.26:1이 6.89로 읽혔다). 파일 전체에 고정 흰 표면
    // 선언이 있으면 그 파일의 컨트롤은 보수적으로 흰 표면 기준으로 잰다.
    // 파일 어딘가에 고정 흰 면이 있으면 **둘 다 재고 최솟값**을 쓴다. 예전엔
    // 흰 면으로 바꿔치웠는데, 흰 면이 더 후한 토큰이 있어(`primary-800`이
    // 램프에서 2.18, 흰 면에서 8.72) 램프에 앉은 컨트롤이 검사에서 빠졌다.
    // 토글이 그 예다 — 썸만 `bg-white`이고 트랙은 램프 면이다.
    if (file !== undefined && FIXED_WHITE_FILES.has(file)) return 'either';
    return 'ramp';
}

/** 고정 흰 표면을 선언한 파일. 파일 단위라 보수적이다 — 그 방향이 안전하다. */
const FIXED_WHITE_FILES = new Set(
    sourceFiles(SRC_DIR)
        .filter(f => !f.includes(`${path.sep}__tests__${path.sep}`))
        .filter(f =>
            // **주석을 지운 뒤** 찾는다. 주석 속 `bg-white` 한 줄이면 그 파일의
            // 판정이 통째로 바뀌던 자리다 — 다른 스캐너는 모두 이미 그렇게 한다.
            /\bbg-(?:white|fixed-|brand-)/.test(
                blankComments(readFileSync(f, 'utf8'))
            )
        )
        .map(f => path.relative(SRC_DIR, f))
);

/**
 * 경계로 쓰기에 대비가 모자란 색인가.
 *
 * **해석하지 못하는 색은 예외를 던진다**(`minContrastOverSurfaces`). 예전엔
 * `null`을 합격으로 접었고, 그래서 Tailwind 기본 팔레트와 임의값이 통째로
 * 무검사 통과했다 — 흰 버튼 위의 `border-white`가 1.00:1인데도.
 */
export function isDecorativeBorder(
    token: string,
    fill: Fill = 'ramp'
): boolean {
    const colour = borderColourPart(token);
    if (colour === null || NON_COLOUR.has(colour)) return false;
    return minContrastOverSurfaces(colour, fill) < MIN_RATIO;
}

/** 클래스 목록 하나를 그 요소의 채움 기준으로 판정한다. */
function decorativeIn(tokens: string[], file?: string): string[] {
    const fill = fillOf(tokens, file);
    return tokens.filter(t => isDecorativeBorder(t, fill));
}

/**
 * 근거를 적은 예외만 여기 둔다. **상수 단위**로 적는다 — 파일 단위로 면제하면
 * 그 파일의 다른 컨트롤까지 통째로 빠져나가 가드에 구멍이 생긴다.
 * 항목을 추가하려면 그 컨트롤이 보더 없이 무엇으로 식별되는지 함께 적을 것.
 */
const ALLOWED_CONSTANTS: ReadonlySet<string> = new Set([
    // 카드용 공용 클래스(IndexCard·SignalStockCard). 소비처가 전부 **카드 표면**이고,
    // 카드의 장식 보더는 globals.css 정책상 1.4.11 대상이 아니다. 그 호버
    // (`hover:border-secondary-600`)도 같은 이유로 대상이 아니다.
    //
    // 이 항목은 상수에 담긴 호버를 처음 잡았을 때 나왔다 — 그 전까지 호버는
    // 인라인 스캐너 하나만 봤고, 클래스를 상수로 옮기는 순간 감시가 꺼졌다.
    'shared/lib/cardStyles.ts::CARD_LINK_CLASSES',
]);

/** 요소 스캐너의 예외. `파일:줄` 단위이며 근거를 함께 적는다. */
const ALLOWED_ELEMENTS: ReadonlySet<string> = new Set([
    // 리포트 복사 버튼. `disabled` 분기(`showProgress || isAnalyzing`)만
    // 장식 보더를 쓰며, WCAG 1.4.11은 비활성 컨트롤을 면제한다.
    //
    // 이 예외는 **여는 태그 전체**를 면제한다. 처음 넣었을 때 근거 주석에
    // "활성 분기는 다른 색을 쓴다"고 적었는데 사실이 아니었고 — `copied`/`failed`만
    // 그랬다 — 평상시 기본 상태인 `idle`이 장식 보더인 채로 그 주석 뒤에 숨었다.
    // 이 자리에 분기를 추가할 때는 이 예외가 그것까지 덮는다는 걸 확인할 것.
    'widgets/analysis/AnalysisPanel.tsx:1012',

    // 드롭다운 메뉴의 첫 항목. `border-b`는 이 항목과 아래 지역 목록을 가르는
    // **구분선**이고, 컨트롤의 경계는 패널 보더 + 상태 채움이 맡는다.
    //
    // 방향 보더를 일괄로 봐주는 휴리스틱을 넣었다가 걷어냈다 — 밑줄형 입력
    // (`border-b`가 경계의 전부, 라이트 1.05:1)이 그 예외로 통과했기 때문이다.
    // 소스만으로는 "항목 사이 줄"과 "요소의 유일한 경계"를 가를 수 없으므로,
    // 휴리스틱 대신 자리마다 판단을 적는다.
    'widgets/layout/HeaderNavMenu.tsx:147',

    // 카드 표면. 링크이지만 제목·설명·시세 블록을 담은 면이고, 보더는 그 면의
    // 장식이지 컨트롤의 경계가 아니다(globals.css 정책의 "카드·패널 장식 보더
    // 제외"). 칩(rounded-full, 텍스트 한 줄)은 보더가 곧 경계라 이 예외에 들지
    // 않는다 — RelatedSymbols·CategoryCardGrid의 칩은 경계 토큰으로 고쳤다.
    'widgets/dashboard/SignalStockCard.tsx:22',
]);

const CLASSNAME_RE = /className="([^"]*)"/;
// 값의 **형태를 미리 제한하지 않는다.** 따옴표나 `cn(`로 시작하는 것만 읽었더니
// 삼항·객체·배열·식별자 시작·큰따옴표 초기화식이 아예 열리지도 않은 채
// "검사했고 통과"로 보고됐다. 일단 읽고, 보더 토큰이 없으면 그냥 넘어가면 된다.
const CONST_DECL_HEAD_RE = /(?:export\s+)?const\s+(\w+)(?:\s*:[^=]*)?\s*=\s*/g;

/**
 * 이름이 컨트롤을 가리키는 클래스 속성. 대문자 합성어까지 받는다 —
 * 소문자 시작으로만 잡았을 때 `submitButtonClassName`류가 통째로 빠져나갔다.
 */
// `:`(객체 속성)뿐 아니라 `=`(JSX 어트리뷰트)도 본다. 래퍼 컴포넌트에 클래스를
// 넘겨 그쪽이 진짜 컨트롤에 얹는 형태가 이 레포에 셋 있는데, 속성만 보던 때는
// 통째로 안 보였다(Footer·not-found의 `triggerClassName=`, HoldingForm의 `inputClassName=`).
const CLASS_PROP_HEAD_RE =
    /(\w*(?:[Bb]utton|[Ll]ink|[Ii]nput|[Tt]rigger|[Cc]ontrol|[Cc]hip|[Tt]ab|[Tt]oggle)ClassName)\s*[:=]\s*\{?\s*/g;

function lineOf(source: string, index: number): number {
    return source.slice(0, index).split('\n').length;
}

function classNameOf(tag: string): string | undefined {
    return (
        CLASSNAME_RE.exec(tag)?.[1] ?? /className=\{([\s\S]*)$/.exec(tag)?.[1]
    );
}

function productFiles(extensions?: string[]): string[] {
    return sourceFiles(SRC_DIR, extensions).filter(
        f => !f.includes(`${path.sep}__tests__${path.sep}`)
    );
}

function findDecorativeControlBorders(
    allowed: ReadonlySet<string> = ALLOWED_ELEMENTS
): string[] {
    const offenders: string[] = [];
    for (const file of productFiles(['.tsx'])) {
        const source = blankComments(readFileSync(file, 'utf8'));
        for (const { tag, index } of controlOpeningTags(source)) {
            const value = classNameOf(tag);
            if (value === undefined) continue;
            const bare = decorativeIn(
                classTokens(value),
                path.relative(SRC_DIR, file)
            );
            if (bare.length === 0) continue;
            const rel = path.relative(SRC_DIR, file);
            const line = lineOf(source, index);
            if (allowed.has(`${rel}:${line}`)) continue;
            offenders.push(`${rel}:${line} ${bare.join(' ')}`);
        }
    }
    return offenders.sort();
}

function findConstantHeldBorders(
    allowed: ReadonlySet<string> = ALLOWED_CONSTANTS
): string[] {
    const offenders: string[] = [];
    const usedOnControls = identifiersUsedOnControls(SRC_DIR);
    for (const file of productFiles()) {
        const source = blankComments(readFileSync(file, 'utf8'));
        for (const match of source.matchAll(CONST_DECL_HEAD_RE)) {
            const name = match[1];
            if (!usedOnControls.has(name)) continue;
            const value = readInitialiser(
                source,
                match.index + match[0].length
            );
            const bare = decorativeIn(
                classTokens(value),
                path.relative(SRC_DIR, file)
            );
            if (bare.length === 0) continue;
            const rel = path.relative(SRC_DIR, file);
            if (allowed.has(`${rel}::${name}`)) continue;
            offenders.push(
                `${rel}:${lineOf(source, match.index)} const ${name} ${bare.join(' ')}`
            );
        }
    }
    return offenders.sort();
}

function findPropHeldBorders(): string[] {
    const offenders: string[] = [];
    for (const file of productFiles()) {
        const source = blankComments(readFileSync(file, 'utf8'));
        for (const match of source.matchAll(CLASS_PROP_HEAD_RE)) {
            const value = readInitialiser(
                source,
                match.index + match[0].length
            );
            const bare = decorativeIn(
                classTokens(value),
                path.relative(SRC_DIR, file)
            );
            if (bare.length === 0) continue;
            offenders.push(
                `${path.relative(SRC_DIR, file)}:${lineOf(source, match.index)} ${match[1]} ${bare.join(' ')}`
            );
        }
    }
    return offenders.sort();
}

describe('control border token guard', () => {
    it('조작 요소의 기본 보더는 3:1을 넘는 색을 쓴다', () => {
        expect(findDecorativeControlBorders()).toEqual([]);
    });

    it('상수에 담은 컨트롤 보더도 같은 규칙을 따른다', () => {
        expect(findConstantHeldBorders()).toEqual([]);
    });

    it('객체 속성에 담은 클래스도 같은 규칙을 따른다', () => {
        expect(findPropHeldBorders()).toEqual([]);
    });

    // `파일:줄` 키는 그 줄이 움직이면 조용히 빗나간다 — 아무것도 면제하지 않거나,
    // 더 나쁘게는 **다른 요소**를 면제한다. 어느 쪽이든 가드는 초록이라 신호가 없다.
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

    it('토큰 파싱이 두께·스타일·방향과 색을 가른다', () => {
        expect(borderColourPart('border-2')).toBeNull();
        expect(borderColourPart('border-solid')).toBeNull();
        expect(borderColourPart('border-b-2')).toBeNull();
        expect(borderColourPart('border-e-2')).toBeNull();
        expect(borderColourPart('ring-1')).toBeNull();
        expect(borderColourPart('ring-inset')).toBeNull();
        expect(borderColourPart('ring-offset-2')).toBeNull();
        expect(borderColourPart('border-secondary-700')).toBe('secondary-700');
        expect(borderColourPart('border-b-secondary-700')).toBe(
            'secondary-700'
        );
        expect(borderColourPart('ring-ui-danger')).toBe('ui-danger');
        expect(borderColourPart('border-primary-500/60')).toBe(
            'primary-500/60'
        );
    });

    it('대비가 모자란 색만 검출한다', () => {
        expect(isDecorativeBorder('border-secondary-700')).toBe(true);
        expect(isDecorativeBorder('border-secondary-800')).toBe(true);
        expect(isDecorativeBorder('border-primary-950')).toBe(true);
        expect(isDecorativeBorder('border-ui-danger/20')).toBe(true);
        expect(isDecorativeBorder('border-border-control')).toBe(false);
        expect(isDecorativeBorder('border-primary-500')).toBe(false);
        expect(isDecorativeBorder('border-transparent')).toBe(false);
    });

    it('컨트롤이 아닌 요소는 대상이 아니다', () => {
        const source =
            '<div className="rounded-lg border border-secondary-700 p-6">카드</div>';
        expect(controlOpeningTags(source)).toHaveLength(0);
        expect(CONTROL_TAGS).toContain('Link');
    });
});
