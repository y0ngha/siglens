import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { controlOpeningTags, sourceFiles } from './support/controlUsage';
import {
    blankComments,
    classTokens,
    stripVariants,
} from './support/sourceScan';
import { MIN_RATIO, minContrastOverSurfaces } from './support/tokenContrast';

/**
 * 알파가 얹힌 색으로 칠한 **그래픽**은 합성 후에도 3:1이어야 한다(WCAG 1.4.11).
 *
 * 왜 이 가드가 따로 필요한가: 같은 결함이 **세 라운드 연속 다른 파일에서**
 * 나왔다. 옵션 차트 막대(`opacity 0.7` → 라이트 2.85), 재무 추이 막대
 * (`fill-chart-bullish/70` → 2.64), 애널리스트 등급 밴드(`bg-ui-success/60`
 * → 2.27). 매번 인스턴스만 고쳤고, 그때마다 "이 파일은 봤으니 됐다"는 신호가 남았다.
 * 토큰 값 자체는 기준을 넘는데 알파가 얹히면 넘지 않는다는 것이 공통 원인이고,
 * 그걸 보는 가드가 없었다.
 *
 * 왜 라이트에서만 터지는가: 라이트 카드는 `#fff`라 어떤 알파든 색을 흰쪽으로
 * 끌어올린다. 다크에서는 같은 알파가 대비를 오히려 키운다. 그래서 다크만
 * 보는 리뷰는 이 계열을 절대 못 잡는다.
 *
 * **범위를 왜 이렇게 잘랐는가.** 트리의 알파 색 유틸리티 283개 중 280개가
 * `bg-*`이고 그중 274개가 3:1 미만이다 — 전부 글자 뒤에 까는 틴트라
 * 그래픽 기준의 대상이 아니다(그건 글자 대비 규칙이 따로 본다). 전부 걸면
 * 가짜 실패 274건이 나오고 가드는 즉시 무력화된다. 그래서 둘로 나눈다:
 *
 * - `fill-`/`stroke-` + 알파 → 어디에 있든 검사한다. SVG 도형은 곧 그래픽이다.
 * - `bg-` + 알파 → **자식이 없는(self-closing) 도형 태그**만 검사한다.
 *   내용을 감싸지 않는 요소는 색을 보여주는 것 말고 할 일이 없다 —
 *   막대 세그먼트와 범례 색칩이 정확히 그 모양이고, 경고 배너 틴트는 아니다.
 *
 * **알려진 한계**: 상수에 담긴 `bg-<토큰>/NN`이 self-closing 태그에 얹히는
 * 형태는 못 본다(`className={BAR}`). `fill-`/`stroke-`는 상수 경유든 아니든
 * 전부 보므로, 지금까지 실제로 난 결함은 모두 덮인다. 이 한계를 없애려면
 * `controlUsage`의 식별자 추적을 `bg-`까지 넓혀야 한다.
 */

const SRC_DIR = path.resolve(__dirname, '../..');

/** 색만 보여주는 도형이 될 수 있는 태그. 컴포넌트(대문자)는 제외한다. */
const GRAPHIC_TAGS = 'div|span|rect|circle|ellipse|path|polygon|polyline|line';

/** 알파가 붙은 색 유틸리티. 알파가 없으면 이 가드의 대상이 아니다. */
const ALPHA_UTILITY_RE = /^(bg|fill|stroke)-([a-z][\w-]*)\/(\d{1,3})$/;

/**
 * `bg-`에서 **의미를 나르는** 색 계열. 이 셋만 상태를 인코딩한다.
 *
 * 중립 램프(`secondary-*`)를 넣었더니 44곳이 걸렸는데 전부 스켈레톤 자리표시자와
 * 패널 배경이었다 — 색이 뜻을 나르지 않으므로 그래픽 기준의 대상이 아니고,
 * 예외 44줄짜리 목록은 가드를 읽는 사람에게 규칙이 아니라 소음으로 읽힌다.
 * `primary-*`도 뺀다: 브랜드 강조색이라 대부분 버튼·배지의 **면**이고, 그
 * 위의 글자 대비는 다른 가드가 본다.
 *
 * 데이터를 나르는 SVG 도형은 계열과 무관하게 전부 걸린다 — `fill-`/`stroke-`
 * 경로에는 이 필터가 없다.
 */
const MEANINGFUL_BG_FAMILIES = /^(ui|chart|grade)-/;

/**
 * 정보를 나르지 않는데 이 스캐너에 걸리는 그래픽. 항목을 넣을 때는
 * **왜 대상이 아닌지 함께 적는다** — 근거 없는 예외는 다음 사람에게
 * "여기는 규칙이 없다"로 읽힌다.
 *
 * 지금은 비어 있다. 진행 막대의 트랙, 모바일 메뉴 스크림, 스켈레톤
 * 자리표시자는 전부 중립 램프거나 `black`이라 위 계열 필터에서 이미 빠진다.
 * 스캐너가 닿지도 않는 항목을 적어두면 그것이 규칙처럼 읽히므로 넣지 않았다.
 */
const ALLOWED: ReadonlySet<string> = new Set<string>([]);

interface Offence {
    where: string;
    utility: string;
    ratio: number;
}

function push(
    out: Offence[],
    file: string,
    index: number,
    source: string,
    token: string
): void {
    const { bare } = stripVariants(token);
    const m = ALPHA_UTILITY_RE.exec(bare);
    if (m === null) return;
    const rel = path.relative(SRC_DIR, file);
    if (ALLOWED.has(`${rel}::${bare}`)) return;
    // 색을 못 읽으면 `minContrastOverSurfaces`가 throw한다 — 그게 옳다.
    // 모르는 색을 통과시키면 임의값과 기본 팔레트가 전부 무검사로 빠진다.
    const ratio = minContrastOverSurfaces(`${m[2]}/${m[3]}`);
    if (ratio >= MIN_RATIO) return;
    out.push({
        where: `${rel}:${source.slice(0, index).split('\n').length}`,
        utility: bare,
        ratio: Number(ratio.toFixed(2)),
    });
}

function offenders(): Offence[] {
    const out: Offence[] = [];
    for (const file of sourceFiles(SRC_DIR)) {
        if (file.includes(`${path.sep}__tests__${path.sep}`)) continue;
        const source = blankComments(readFileSync(file, 'utf8'));

        // 1) `fill-`/`stroke-`는 어디에 적혀 있든 본다. 상수에 담겨 태그와
        //    떨어져 있는 형태가 실제 결함이었다(`COLOR_CLASSES.bullish.fill`).
        source.split('\n').forEach((line, i) => {
            const at =
                source.split('\n').slice(0, i).join('\n').length +
                (i > 0 ? 1 : 0);
            for (const token of classTokens(line)) {
                const { bare } = stripVariants(token);
                if (!/^(fill|stroke)-/.test(bare)) continue;
                push(out, file, at, source, token);
            }
        });

        // 2) `bg-`는 **자식 없는 도형 태그**에서만 본다.
        if (!file.endsWith('.tsx')) continue;
        for (const { tag, index } of controlOpeningTags(source, GRAPHIC_TAGS)) {
            if (!tag.trimEnd().endsWith('/>')) continue;
            const cls = /\bclassName="([^"]*)"/.exec(tag)?.[1] ?? '';
            for (const token of classTokens(cls)) {
                const { bare } = stripVariants(token);
                if (!bare.startsWith('bg-')) continue;
                if (!MEANINGFUL_BG_FAMILIES.test(bare.slice('bg-'.length)))
                    continue;
                push(out, file, index, source, token);
            }
        }
    }
    return out.sort((a, b) => a.where.localeCompare(b.where));
}

describe('graphic alpha contrast guard', () => {
    it('알파가 얹힌 그래픽이 합성 후에도 3:1을 넘는다', () => {
        expect(offenders()).toEqual([]);
    });

    /**
     * 규칙의 근거를 숫자로 붙들어 둔다. 이 계열이 `/85`로 수렴한 것은
     * 취향이 아니라 측정 결과다 — `/80`은 라이트에서 3.09로 아슬아슬하고
     * `/70`은 2.64로 미달이다. 토큰 값이 바뀌어 이 관계가 흔들리면 규칙
     * 자체를 다시 봐야 한다.
     */
    it('막대 계열의 알파 하한이 실제로 /85다', () => {
        for (const name of ['chart-bullish', 'ui-success']) {
            expect(minContrastOverSurfaces(`${name}/70`)).toBeLessThan(
                MIN_RATIO
            );
            expect(
                minContrastOverSurfaces(`${name}/85`)
            ).toBeGreaterThanOrEqual(MIN_RATIO);
        }
    });

    it('검출기가 실제로 잡는다', () => {
        expect(ALPHA_UTILITY_RE.test('bg-ui-success/60')).toBe(true);
        expect(ALPHA_UTILITY_RE.test('fill-chart-bullish/70')).toBe(true);
        expect(ALPHA_UTILITY_RE.test('stroke-primary-500/40')).toBe(true);
        // 알파가 없으면 대상이 아니다 — 토큰 자체의 대비는 다른 가드가 본다.
        expect(ALPHA_UTILITY_RE.test('bg-ui-success')).toBe(false);
        expect(ALPHA_UTILITY_RE.test('text-ui-danger/80')).toBe(false);
    });
});
