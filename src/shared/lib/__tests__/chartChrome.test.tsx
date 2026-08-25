import { afterEach, describe, expect, it } from 'vitest';

import {
    CHART_COLORS,
    CHART_COLORS_LIGHT,
    getChartChrome,
} from '../chartColors';

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

    it('두 팔레트가 실제로 다른 값을 준다', () => {
        // 라이트 오버라이드가 다크를 그대로 복사해 두면 위 세 테스트가 전부
        // 통과하면서도 라이트 차트는 검은 채로 남는다.
        expect(CHART_COLORS_LIGHT.background).not.toBe(CHART_COLORS.background);
        expect(CHART_COLORS_LIGHT.text).not.toBe(CHART_COLORS.text);
    });
});
