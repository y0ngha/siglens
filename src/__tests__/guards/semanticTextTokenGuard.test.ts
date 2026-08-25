import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { sourceFiles } from './support/controlUsage';
import { blankComments, classTokens } from './support/sourceScan';
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

/** 표면용 의미 색. 텍스트에 쓰려면 `-text` 짝을 써야 한다. */
const SURFACE_ONLY = ['ui-danger', 'ui-warning', 'ui-success'] as const;

const TEXT_UTILITY_RE = new RegExp(
    `^text-(${SURFACE_ONLY.join('|')})(?:/\\d+)?$`
);

function offenders(): string[] {
    const out: string[] = [];
    for (const file of sourceFiles(SRC_DIR)) {
        if (file.includes(`${path.sep}__tests__${path.sep}`)) continue;
        const source = blankComments(readFileSync(file, 'utf8'));
        source.split('\n').forEach((line, i) => {
            for (const token of classTokens(line)) {
                if (!TEXT_UTILITY_RE.test(token)) continue;
                out.push(`${path.relative(SRC_DIR, file)}:${i + 1} ${token}`);
            }
        });
    }
    return out.sort();
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
                // 이 계열이 실제로 앉는 자리: 자기 색 5% 틴트 위.
                const tint = mix(surface as string, 0.05, page as string);
                const surfaceRatio = contrast(surface as string, tint);
                const textRatio = contrast(text as string, tint);
                expect(
                    textRatio,
                    `${theme} ${name}: text ${textRatio.toFixed(2)} vs surface ${surfaceRatio.toFixed(2)}`
                ).toBeGreaterThan(surfaceRatio);
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
