import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { sourceFiles } from './support/controlUsage';
import {
    blankComments,
    classTokens,
    stripVariants,
} from './support/sourceScan';
import {
    MIN_RATIO,
    contrast,
    readThemes,
    relativeLuminance,
} from './support/tokenContrast';

/**
 * 의미 색은 **역할이 이름에 있다.** `ui-danger`는 배경·보더용 표면색이고,
 * 텍스트에는 `ui-danger-text`를 쓴다.
 *
 * 왜 가드가 필요한가: 이 구분이 없으면 라이트 테마에서만 조용히 깨진다.
 * 표면 토큰을 텍스트로 쓰면 페이지 램프 위에서 4.25~4.43:1로 4.5를 밑돌고,
 * 카드(#fff) 위에서도 4.52~4.68로 겨우 넘는다. 다크에서는 5.2~8.8이라
 * 통과하므로 다크만 보면 아무 문제가 없어 보인다.
 *
 * 실제로 그렇게 새어 나갔다. 감사가 `/market`과 `/login`에서 두 건을 잡아
 * 고쳤는데, 그건 **인스턴스**를 고친 것이었고 같은 패턴이 트리에 54곳
 * 남아 있었다. 다음 라운드 감사가 `/terms`에서 4.28:1을 찾아내며 그 사실을
 * 드러냈다 — 두 번 다 "보이는 것만 고치고 패턴을 안 훑은" 결과다.
 *
 * 이 가드는 표면 토큰이 텍스트 자리에 오는 것 자체를 막는다. 값이 아니라
 * **역할**을 검사하므로, 나중에 토큰 값이 바뀌어도 규칙이 살아 있다.
 */

const SRC_DIR = path.resolve(__dirname, '../..');

/**
 * 표면용 의미 색. 텍스트에 쓰려면 `-text` 짝을 써야 한다.
 *
 * `grade-a..f`가 뒤늦게 들어왔다 — globals.css가 그 계열에도 같은 분리와
 * 근거("4.32~4.48 AA 미달")를 적어뒀는데 가드는 `ui-*`만 보고 있었다.
 * 한 계열만 막는 가드는 "이 규칙은 여기만 해당"이라는 잘못된 신호를 준다.
 */
const SURFACE_ONLY = [
    'ui-danger',
    'ui-warning',
    'ui-success',
    'grade-a',
    'grade-b',
    'grade-c',
    'grade-d',
    'grade-f',
] as const;

/**
 * `-text` 짝이 아예 없는 그래픽 전용 색. 텍스트에는 쓸 수 없고, 대신 쓸
 * 토큰을 함께 알려준다 — 이 계열은 라이트 인셋 표면에서 4.23~4.30이라
 * **틴트가 없어도** 본문 기준을 밑돈다.
 */
const GRAPHICS_ONLY: Record<string, string> = {
    'chart-bullish':
        'text-ui-success-text (텍스트) / fill-·stroke-chart-bullish (그래픽)',
    'chart-bearish':
        'text-ui-danger-text (텍스트) / fill-·stroke-chart-bearish (그래픽)',
};

const TEXT_UTILITY_RE = new RegExp(
    `^text-(${[...SURFACE_ONLY, ...Object.keys(GRAPHICS_ONLY)].join('|')})(?:/\\d+)?$`
);

/**
 * 근거를 적은 예외만 둔다. **`파일:심볼` 단위**로 적고, 왜 본문 기준이
 * 적용되지 않는지 함께 쓴다.
 */
const ALLOWED: ReadonlySet<string> = new Set([
    // 등급 게이지의 호(arc)는 SVG `stroke`다 — 글자가 아니라 그래픽이므로
    // 1.4.11의 3:1이 적용되고, 이 계열은 민 표면에서 4.1 이상이라 통과한다.
    'widgets/financials/CompositeGradeGauge.tsx::SEGMENTS',
    // 큰 등급 글자는 `text-4xl font-bold`(36px)라 WCAG의 **큰 텍스트**에
    // 해당해 기준이 3:1이다. 같은 이유로 `-text` 짝이 필요 없다.
    'widgets/financials/CompositeGradeGauge.tsx::GRADE_TEXT_COLOR',
]);

function offenders(): string[] {
    const out: string[] = [];
    for (const file of sourceFiles(SRC_DIR)) {
        if (file.includes(`${path.sep}__tests__${path.sep}`)) continue;
        const source = blankComments(readFileSync(file, 'utf8'));
        const lines = source.split('\n');
        lines.forEach((line, i) => {
            for (const token of classTokens(line)) {
                // **변형을 벗기고 본다.** `^text-…$` 앵커만 두었더니 `hover:` 하나에
                // 가드가 통째로 무력화됐다 — 형제 가드가 같은 커밋에서 고친
                // 결함인데 이 파일은 공용 구현을 안 쓰고 있었다.
                const { bare } = stripVariants(token);
                if (!TEXT_UTILITY_RE.test(bare)) continue;
                const rel = path.relative(SRC_DIR, file);
                // 이 줄이 속한 상수 이름으로 예외를 찾는다. **실제 줄 번호로**
                // 거슬러 올라간다 — 예전엔 `source.indexOf(line)`으로 줄 텍스트를
                // 다시 찾았는데, 그러면 같은 텍스트를 가진 **첫** 줄이 잡혀서
                // 면제되지 않은 상수가 면제된 상수의 예외를 그대로 물려받았다.
                const holder = /(?:const|let)\s+(\w+)/.exec(
                    lines
                        .slice(0, i + 1)
                        .reverse()
                        .find(l => /(?:const|let)\s+\w+/.test(l)) ?? ''
                )?.[1];
                if (holder !== undefined && ALLOWED.has(`${rel}::${holder}`)) {
                    continue;
                }
                out.push(`${rel}:${i + 1} ${token}`);
            }
        });
    }
    return out.sort();
}

/**
 * **그 토큰이** 실제로 얹히는 틴트 알파들. 하드코딩한 5% 하나로 규칙을
 * 뒷받침하면 실사용(최대 40%)을 못 덮는다 — 근거가 규칙보다 좁으면 규칙이
 * 틀려도 안 걸린다. 반대로 전 계열의 알파를 한데 모으면 코드에 없는 조합을
 * 만들어 검사하게 되므로, 토큰별로 모은다.
 */
let alphaCache: Map<string, number[]> | null = null;

/**
 * 트리를 **한 번만** 훑는다. 토큰마다 다시 훑었더니 8토큰 × 2테마 = 16회
 * 전체 스캔이 되어 기본 5초 타임아웃을 넘겼다 — 가드 하나만 돌릴 땐 통과하고
 * 전체 스위트에서만 실패해, 원인이 격리 문제처럼 보였다.
 */
function buildAlphaIndex(): Map<string, number[]> {
    if (alphaCache !== null) return alphaCache;
    const acc = new Map<string, Set<number>>();
    const pairRe =
        /\bbg-((?:ui-[a-z]+|grade-[a-f]|chart-[a-z]+))\/(\d{1,3})\b/g;
    for (const file of sourceFiles(SRC_DIR)) {
        if (file.includes(`${path.sep}__tests__${path.sep}`)) continue;
        const source = blankComments(readFileSync(file, 'utf8'));
        for (const line of source.split('\n')) {
            for (const m of line.matchAll(pairRe)) {
                const token = m[1];
                if (!new RegExp(`\\btext-${token}-text\\b`).test(line))
                    continue;
                const pct = Number(m[2]);
                if (pct <= 0 || pct > 100) continue;
                const set = acc.get(token) ?? new Set<number>();
                set.add(pct / 100);
                acc.set(token, set);
            }
        }
    }
    alphaCache = new Map(
        [...acc].map(([k, v]) => [k, [...v].sort((a, b) => a - b)])
    );
    return alphaCache;
}

function tintAlphasInSource(token: string): number[] {
    return [0.05, ...(buildAlphaIndex().get(token) ?? [])].sort(
        (a, b) => a - b
    );
}

describe('semantic text token guard', () => {
    it('의미 색의 표면 토큰을 텍스트 색으로 쓰지 않는다', () => {
        expect(offenders()).toEqual([]);
    });

    /**
     * 규칙의 근거를 숫자로 붙들어 둔다. `-text` 짝이 표면 토큰보다 실제로
     * 대비가 높다는 것이 이 규칙의 전부이므로, 토큰 값이 바뀌어 그 관계가
     * 뒤집히면 규칙 자체를 다시 봐야 한다.
     */
    it('-text 토큰이 표면 토큰보다 대비가 높다', () => {
        const themes = readThemes();
        for (const name of SURFACE_ONLY) {
            for (const theme of ['dark', 'light'] as const) {
                const tokens = themes[theme];
                const surface = tokens.get(`--color-${name}`);
                const text = tokens.get(`--color-${name}-text`);
                const page = tokens.get('--color-secondary-900');
                expect(surface, `${theme} ${name}`).toBeDefined();
                expect(text, `${theme} ${name}-text`).toBeDefined();
                expect(page).toBeDefined();
                // **소스에 실제로 쓰이는 알파 전부**에 대해 본다. 5%만 재던 때는
                // 규칙의 근거가 실사용을 못 덮었다 — 이 계열은 `/40`까지 쓰이고,
                // 인셋 표면 위 `/40`에서는 `-text`조차 4.36으로 빠듯하다.
                // **그 토큰에** 실제로 쓰이는 알파만 본다. 전 계열의 알파를
                // 모아 교차하면 코드에 존재하지 않는 조합을 만들어 검사하게 된다.
                const alphas = tintAlphasInSource(name);
                let surfaceRatio = Infinity;
                let textRatio = Infinity;
                for (const alpha of alphas) {
                    const tint = mix(surface as string, alpha, page as string);
                    surfaceRatio = Math.min(
                        surfaceRatio,
                        contrast(surface as string, tint)
                    );
                    textRatio = Math.min(
                        textRatio,
                        contrast(text as string, tint)
                    );
                }
                // 다크에서는 두 토큰이 같은 값인 계열이 있다(분리가 라이트
                // 전용). "더 높다"가 아니라 "낮지 않다"가 실제 불변식이다 —
                // 처음엔 엄격하게 적었다가 `grade-a` 다크에서 8.33 대 8.33으로
                // 걸렸다.
                expect(
                    textRatio,
                    `${theme} ${name}: text ${textRatio.toFixed(2)} vs surface ${surfaceRatio.toFixed(2)}`
                ).toBeGreaterThanOrEqual(surfaceRatio);
                expect(
                    textRatio,
                    `${theme} ${name}-text가 본문 대비 기준 미달`
                ).toBeGreaterThanOrEqual(4.5);
            }
        }
    });

    it('검출기가 실제로 잡는다', () => {
        expect(TEXT_UTILITY_RE.test('text-ui-danger')).toBe(true);
        expect(TEXT_UTILITY_RE.test('text-ui-warning/80')).toBe(true);
        expect(TEXT_UTILITY_RE.test('text-ui-danger-text')).toBe(false);
        expect(TEXT_UTILITY_RE.test('bg-ui-danger')).toBe(false);
        expect(TEXT_UTILITY_RE.test('border-ui-danger/30')).toBe(false);
        expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
        expect(MIN_RATIO).toBe(3);
    });
});

/** hex 두 개를 알파로 섞는다. */
function mix(fg: string, alpha: number, bg: string): string {
    const px = (h: string): number[] => {
        let s = h.slice(1);
        if (s.length === 3) s = [...s].map(c => c + c).join('');
        return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16));
    };
    const [f, b] = [px(fg), px(bg)];
    return `#${f
        .map((c, i) => Math.round(c * alpha + b[i] * (1 - alpha)))
        .map(c => c.toString(16).padStart(2, '0'))
        .join('')}`;
}
