import { describe, expect, it } from 'vitest';

import {
    CHART_COLORS_LIGHT,
    CHART_COLORS_RAW_DARK,
} from '@/shared/lib/chartColors';
import { MIN_RATIO, contrast } from './support/tokenContrast';

/**
 * 프리·애프터마켓 색의 **알파 합성** 대비 가드(DESIGN.md "시간외 구간", DS-11·DS-12).
 *
 * `chartPaletteContrastGuard`는 알파를 떼고 밑색만 잰다. 그래서 밴드(알파 ~12%)와 거래량 막대(알파 있음)는
 * 가드가 못 본다 — 시간외 캔들은 **밴드 위에** 그려지므로 재야 할 배경은 차트 배경이 아니라 "밴드를 깐
 * 배경"이다. 여기서 실제로 합성해 잰다.
 */
type Palette = Record<string, string>;

function paletteFor(theme: 'dark' | 'light'): Palette {
    const dark = CHART_COLORS_RAW_DARK as Palette;
    return theme === 'dark'
        ? dark
        : { ...dark, ...(CHART_COLORS_LIGHT as Palette) };
}

const hexOf = (rgb: number[]): string =>
    `#${rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** `#rrggbb` 또는 `#rrggbbaa`를 `fg`(밑색)와 알파로 나눈다. */
function split(value: string): { base: string; alpha: number } {
    return value.length === 9
        ? {
              base: value.slice(0, 7),
              alpha: parseInt(value.slice(7, 9), 16) / 255,
          }
        : { base: value, alpha: 1 };
}

function composite(value: string, over: string): string {
    const { base, alpha } = split(value);
    const channels = (hex: string): number[] =>
        [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    const fg = channels(base);
    const bg = channels(over);
    return hexOf(fg.map((c, i) => c * alpha + bg[i]! * (1 - alpha)));
}

describe.each(['dark', 'light'] as const)(
    '시간외 색 — %s 테마 합성 대비',
    theme => {
        const palette = paletteFor(theme);
        const background = palette.background!;
        const band = composite(palette.extendedSessionBand!, background);

        it('밴드는 배경과 구분되되 옅다(1.05~1.3:1)', () => {
            const ratio = contrast(band, background);
            expect(ratio).toBeGreaterThanOrEqual(1.05);
            expect(ratio).toBeLessThanOrEqual(1.3);
        });

        it.each(['extendedBullish', 'extendedBearish'] as const)(
            '%s 테두리·심지는 밴드 위에서 3:1 이상이다(알파 없이)',
            key => {
                const value = palette[key]!;
                expect(split(value).alpha).toBe(1);
                expect(contrast(value, band)).toBeGreaterThanOrEqual(MIN_RATIO);
                expect(contrast(value, background)).toBeGreaterThanOrEqual(
                    MIN_RATIO
                );
            }
        );

        it('시간외 거래량 막대는 밴드 위에서 3:1 이상이다(알파 합성 후)', () => {
            const bar = composite(palette.extendedVolume!, band);
            expect(contrast(bar, band)).toBeGreaterThanOrEqual(MIN_RATIO);
        });
    }
);
