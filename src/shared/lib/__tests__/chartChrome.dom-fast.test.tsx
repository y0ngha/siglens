import { readFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    CHART_COLORS,
    CHART_COLORS_LIGHT,
    getChartChrome,
} from '../chartColors';

const GLOBALS_CSS = path.resolve(__dirname, '../../../app/globals.css');

/**
 * 라이트 테마 차트 경로에 테스트가 하나도 없었다. 더 나쁜 건, 차트 테스트
 * 여섯 파일이 전부 `getChartChrome`을 `vi.mock`으로 갈아끼워서 `data-theme`
 * 분기가 **어디서도 실행되지 않는** 상태였다는 점이다. 차트는 CSS 변수를 못
 * 읽어 JS로 색을 받으므로, 이 분기가 틀리면 라이트에서 차트만 검게 남는다.
 *
 * 여기서는 모의 없이 실물을 부른다 — 그게 이 파일의 존재 이유다.
 */
describe('getChartChrome', () => {
    afterEach(() => {
        document.documentElement.removeAttribute('data-theme');
    });

    it('data-theme이 light면 라이트 색을 준다', () => {
        document.documentElement.setAttribute('data-theme', 'light');
        expect(getChartChrome()).toEqual({
            background: CHART_COLORS_LIGHT.background,
            grid: CHART_COLORS_LIGHT.grid,
            text: CHART_COLORS_LIGHT.text,
        });
    });

    it('data-theme이 dark면 다크 색을 준다', () => {
        document.documentElement.setAttribute('data-theme', 'dark');
        expect(getChartChrome()).toEqual({
            background: CHART_COLORS.background,
            grid: CHART_COLORS.grid,
            text: CHART_COLORS.text,
        });
    });

    it('data-theme이 없으면 다크로 떨어진다', () => {
        expect(getChartChrome().background).toBe(CHART_COLORS.background);
    });

    /**
     * **지표 색도 테마를 따른다.** 한때 크롬 3키만 테마별 값이 있었고 나머지
     * 112개는 두 테마 공용이었는데, 그 팔레트는 다크 배경 전용으로 튜닝돼
     * 있어서 라이트에서 75개가 3:1을 밑돌았다(최악 1.36:1). 차트는 canvas라
     * DOM 프로브가 볼 수 없어 감사 12라운드가 전부 놓쳤다.
     *
     * `CHART_COLORS`는 이제 **접근 시점에** 테마를 보는 게터다. 이 테스트는
     * 그 배선이 살아 있는지만 본다 — 값의 대비는 `chartPaletteContrastGuard`가
     * 따로 강제한다.
     */
    it('지표 색이 테마에 따라 달라진다', () => {
        document.documentElement.setAttribute('data-theme', 'light');
        const light = CHART_COLORS.bullish;
        document.documentElement.setAttribute('data-theme', 'dark');
        const dark = CHART_COLORS.bullish;

        expect(light).toBe(CHART_COLORS_LIGHT.bullish);
        expect(dark).not.toBe(light);
    });

    /**
     * 오버라이드가 없는 키는 다크 값으로 떨어져야 한다 — 라이트에서 값이
     * `undefined`가 되면 lightweight-charts가 색을 못 받아 선이 사라진다.
     */
    it('라이트 오버라이드가 없는 키는 다크 값을 그대로 쓴다', () => {
        document.documentElement.setAttribute('data-theme', 'light');
        expect(CHART_COLORS.macdLine).toBe('#3b82f6');
        expect(
            Object.values(CHART_COLORS).every(
                v => typeof v === 'string' && v.startsWith('#')
            )
        ).toBe(true);
    });

    /**
     * 팔레트를 **globals.css의 토큰에 못 박는다.**
     *
     * 위 테스트들은 두 팔레트가 서로 다르다는 것만 증명한다. 차트 색은 JS
     * 리터럴이고 페이지 색은 CSS 변수라, 한쪽만 바꾸면 차트가 주변 면과
     * 어긋나는데 어느 테스트도 그걸 못 본다 — 팔레트 대 팔레트 비교는 배선을
     * 증명하지 않는다.
     */
    it('차트 팔레트가 globals.css 토큰과 일치한다', () => {
        const css = readFileSync(GLOBALS_CSS, 'utf8');
        const tokenIn = (block: string, name: string): string => {
            const m = new RegExp(`${name}\\s*:\\s*(#[0-9a-fA-F]{3,8})`).exec(
                block
            );
            if (m === null) throw new Error(`${name}를 못 찾았다`);
            return m[1];
        };
        const lightStart = css.indexOf(":root[data-theme='light']");
        expect(lightStart).toBeGreaterThan(-1);
        const darkBlock = css.slice(0, lightStart);
        const lightBlock = css.slice(lightStart);

        expect(CHART_COLORS.background).toBe(
            tokenIn(darkBlock, '--color-secondary-900')
        );
        expect(CHART_COLORS.text).toBe(
            tokenIn(darkBlock, '--color-secondary-500')
        );
        expect(CHART_COLORS_LIGHT.background).toBe(
            tokenIn(lightBlock, '--color-secondary-900')
        );
        expect(CHART_COLORS_LIGHT.grid).toBe(
            tokenIn(lightBlock, '--color-secondary-700')
        );
        expect(CHART_COLORS_LIGHT.text).toBe(
            tokenIn(lightBlock, '--color-secondary-500')
        );
    });

    it('두 팔레트가 실제로 다른 값을 준다', () => {
        // 라이트 오버라이드가 다크를 그대로 복사해 두면 위 세 테스트가 전부
        // 통과하면서도 라이트 차트는 검은 채로 남는다.
        expect(CHART_COLORS_LIGHT.background).not.toBe(CHART_COLORS.background);
        expect(CHART_COLORS_LIGHT.text).not.toBe(CHART_COLORS.text);
    });
});
