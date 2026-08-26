// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { usePricePaneStretch } from '@/widgets/chart/hooks/usePricePaneStretch';
import type { PaneIndices } from '@/widgets/chart/types';

vi.mock('lightweight-charts', () => ({}));

const PANE_INDICES = {} as PaneIndices;

function makeChart(paneCount: number) {
    const setStretchFactor = vi.fn();
    const panes = Array.from({ length: paneCount }, () => ({
        setStretchFactor,
    }));
    return { chart: { panes: () => panes }, setStretchFactor };
}

function makeChartRef(chart: unknown) {
    return { current: chart } as Parameters<typeof usePricePaneStretch>[0];
}

function render(paneCount: number) {
    const { chart, setStretchFactor } = makeChart(paneCount);
    renderHook(() => usePricePaneStretch(makeChartRef(chart), PANE_INDICES));
    return setStretchFactor;
}

describe('usePricePaneStretch', () => {
    it('차트가 없으면 아무것도 하지 않는다', () => {
        expect(() =>
            renderHook(() =>
                usePricePaneStretch(makeChartRef(null), PANE_INDICES)
            )
        ).not.toThrow();
    });

    it('pane이 하나도 없으면 아무것도 하지 않는다', () => {
        expect(render(0)).not.toHaveBeenCalled();
    });

    it('보조 pane이 2개 이하면 LWC 기본값(2)을 유지한다', () => {
        // 이 구간에서 배치가 바뀌면 회귀다 — 기존 화면이 그대로여야 한다.
        expect(render(1)).toHaveBeenCalledWith(2);
        expect(render(2)).toHaveBeenCalledWith(2);
        expect(render(3)).toHaveBeenCalledWith(2);
    });

    it('보조 pane이 3개면 가격 pane 몫을 40%에서 50%로 올린다', () => {
        // 감사 실측: 246px 차트에서 86px(=40%)이었다.
        expect(render(4)).toHaveBeenCalledWith(3);
    });

    it('보조 pane이 몇 개든 가격 pane이 절반 아래로 내려가지 않는다', () => {
        for (let subPanes = 1; subPanes <= 8; subPanes += 1) {
            const setStretchFactor = render(subPanes + 1);
            const stretch = setStretchFactor.mock.calls[0][0] as number;
            // LWC는 stretch 비율로만 높이를 나눈다: 몫 = S / (S + N).
            const share = stretch / (stretch + subPanes);
            expect(share).toBeGreaterThanOrEqual(0.5);
        }
    });
});
