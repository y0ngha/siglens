import { describe, expect, it } from 'vitest';

import {
    CHART_COLORS_LIGHT,
    CHART_COLORS_RAW_DARK,
} from '@/shared/lib/chartColors';

/**
 * 차트 지표 색이 **양 테마 배경에서** WCAG 1.4.11의 3:1을 넘는지 강제한다.
 *
 * 왜 따로 필요한가: 차트는 canvas로 그려져 **DOM 접근성 프로브가 원리적으로
 * 볼 수 없다.** 배포 전 감사 12라운드가 라우트마다 대비를 쟀는데도 전부
 * 놓쳤고, `usePaneLabels`가 만드는 범례 점이 우연히 DOM 요소여서 실마리가
 * 잡혔다. 그때 소스 상수를 직접 재보니 라이트 배경에서 112개 중 75개가
 * 기준 미달, 최악은 1.36:1이었다. 관측 경로는 이것뿐이다.
 *
 * 이 가드는 렌더가 아니라 **상수**를 잰다. 그래서 실행 환경도, 브라우저도,
 * 스켈레톤이 풀렸는지도 상관없다.
 */

const hexToRgb = (hex: string): [number, number, number] => {
    let h = hex.slice(1);
    if (h.length === 3) h = [...h].map(c => c + c).join('');
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) as [
        number,
        number,
        number,
    ];
};

const relativeLuminance = ([r, g, b]: readonly number[]): number => {
    const lin = (v: number): number => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

const contrast = (a: string, b: string): number => {
    const [hi, lo] = [
        relativeLuminance(hexToRgb(a)),
        relativeLuminance(hexToRgb(b)),
    ].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
};

/** CIE76 ΔE — 지각 거리. 대비비는 휘도만 보므로 색 구분에는 쓸 수 없다. */
const toLab = (hex: string): [number, number, number] => {
    const lin = (v: number): number => {
        const c = v / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const [r, g, b] = hexToRgb(hex).map(lin);
    const f = (v: number): number =>
        v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116;
    const x = f((r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047);
    const y = f(r * 0.2126 + g * 0.7152 + b * 0.0722);
    const z = f((r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
};

const deltaE = (a: string, b: string): number => {
    const [l1, a1, b1] = toLab(a);
    const [l2, a2, b2] = toLab(b);
    return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
};

/** 그래픽 최소 대비(WCAG 1.4.11). */
const MIN_RATIO = 3;

/** 크롬 3키는 색이 아니라 면·격자·축이라 이 규칙의 대상이 아니다. */
const CHROME_KEYS = new Set(['background', 'grid', 'text']);

/**
 * 같은 pane에 **동시에 그려질 수 있는** 색들. 서로 구분돼야 정보가 산다.
 * 가격 pane만 본다 — 보조지표는 각자 자기 pane에 있어 겹치지 않는다.
 */
const PRICE_PANE_KEYS = [
    'bullish',
    'bearish',
    'bollingerUpper',
    'keltnerUpper',
    'keltnerMiddle',
    'donchianUpper',
    'donchianMiddle',
    'period5',
    'period10',
    'period20',
    'period60',
    'period120',
    'period200',
    'vwap',
    'neutral',
    'actionEntry',
] as const;

/**
 * 다크 팔레트의 가격 pane 최소 ΔE. 라이트가 이보다 나빠지면 안 된다.
 *
 * 절대값이 아니라 **다크와의 비교**로 적는 이유: 이 제품은 다크에서도
 * 어느 정도 겹침을 허용한다(하락 캔들과 MA5가 6.89로 가장 가깝다). 라이트에만
 * 더 엄격한 기준을 들이대면 통과할 수 없는 규칙이 된다.
 */
const DARK_MIN_DELTA_E = 6.9;

type Palette = Record<string, string>;

function paletteFor(theme: 'dark' | 'light'): Palette {
    const dark = CHART_COLORS_RAW_DARK as Palette;
    if (theme === 'dark') return dark;
    return { ...dark, ...(CHART_COLORS_LIGHT as Palette) };
}

/** 알파 접미사(`#rrggbbaa`)를 떼고 밑색만 본다 — 알파는 배경 위에서 별도로 잰다. */
const baseHex = (value: string): string =>
    value.length === 9 ? value.slice(0, 7) : value;

function offenders(theme: 'dark' | 'light'): string[] {
    const palette = paletteFor(theme);
    const background = palette.background;
    const out: string[] = [];
    for (const [key, value] of Object.entries(palette)) {
        if (CHROME_KEYS.has(key)) continue;
        const ratio = contrast(baseHex(value), background);
        if (ratio < MIN_RATIO) {
            out.push(`${key} ${value} = ${ratio.toFixed(2)}:1`);
        }
    }
    return out.sort();
}

describe('chart palette contrast guard', () => {
    it.each(['dark', 'light'] as const)(
        '%s 테마의 지표 색이 배경 위에서 3:1을 넘는다',
        theme => {
            expect(offenders(theme)).toEqual([]);
        }
    );

    /**
     * 대비만 맞추면 전부 비슷한 명도로 모여 서로 구분이 사라진다. 그건 대비비로는
     * 안 보이므로(같은 배경에 맞춘 색끼리는 1.0이 나온다) 지각 거리로 따로 본다.
     */
    it('라이트 팔레트의 색 구분이 다크보다 나빠지지 않는다', () => {
        const measure = (theme: 'dark' | 'light'): number => {
            const palette = paletteFor(theme);
            let min = Infinity;
            for (let i = 0; i < PRICE_PANE_KEYS.length; i += 1) {
                for (let j = i + 1; j < PRICE_PANE_KEYS.length; j += 1) {
                    min = Math.min(
                        min,
                        deltaE(
                            baseHex(palette[PRICE_PANE_KEYS[i]]),
                            baseHex(palette[PRICE_PANE_KEYS[j]])
                        )
                    );
                }
            }
            return min;
        };
        expect(measure('dark')).toBeCloseTo(DARK_MIN_DELTA_E, 0);
        expect(measure('light')).toBeGreaterThanOrEqual(DARK_MIN_DELTA_E);
    });

    /**
     * 라이트 오버라이드가 다크에 없는 키를 만들면 그 색은 어디에도 안 쓰이는
     * 죽은 값이 되고, 오타가 조용히 통과한다.
     */
    it('라이트 오버라이드의 키가 전부 다크에 존재한다', () => {
        const darkKeys = new Set(Object.keys(CHART_COLORS_RAW_DARK));
        const stray = Object.keys(CHART_COLORS_LIGHT).filter(
            k => !darkKeys.has(k)
        );
        expect(stray).toEqual([]);
    });

    it('측정기가 실제로 잰다', () => {
        expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 1);
        expect(contrast('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
        // 같은 배경에 맞춘 두 색은 대비비 ~1이지만 지각 거리는 크다.
        expect(deltaE('#1e9388', '#de5b00')).toBeGreaterThan(40);
        expect(deltaE('#1e9388', '#1e9388')).toBe(0);
    });
});
