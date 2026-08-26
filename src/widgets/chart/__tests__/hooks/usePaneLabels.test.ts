// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import type { PaneLabelConfig } from '../../types';
import { usePaneLabels } from '../../hooks/usePaneLabels';

vi.mock('lightweight-charts', () => ({}));

const mockObserve = vi.fn();
const mockDisconnect = vi.fn();

class MockResizeObserver {
    observe = mockObserve;
    unobserve = vi.fn();
    disconnect = mockDisconnect;
}

vi.stubGlobal('ResizeObserver', MockResizeObserver);

afterAll(() => {
    vi.unstubAllGlobals();
});

function makeChartRef(chart: unknown = null) {
    return { current: chart } as Parameters<
        typeof usePaneLabels
    >[0]['chartRef'];
}

function makeContainerRef(container: HTMLDivElement | null = null) {
    return { current: container } as Parameters<
        typeof usePaneLabels
    >[0]['containerRef'];
}

function makeChart() {
    return {
        panes: vi.fn(() => [
            { getHeight: () => 200 },
            { getHeight: () => 100 },
        ]),
    };
}

const LABELS: PaneLabelConfig[] = [
    {
        paneIndex: 1,
        subLabels: [{ name: 'RSI', color: '#a78bfa' }],
    },
];

describe('usePaneLabels', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns void', () => {
        const { result } = renderHook(() =>
            usePaneLabels({
                chartRef: makeChartRef(),
                containerRef: makeContainerRef(),
                labels: [],
            })
        );

        expect(result.current).toBeUndefined();
    });

    it('does nothing when container is null', () => {
        const chart = makeChart();
        renderHook(() =>
            usePaneLabels({
                chartRef: makeChartRef(chart),
                containerRef: makeContainerRef(null),
                labels: LABELS,
            })
        );

        expect(chart.panes).not.toHaveBeenCalled();
    });

    it('does nothing when chart is null', () => {
        const container = document.createElement('div');
        renderHook(() =>
            usePaneLabels({
                chartRef: makeChartRef(null),
                containerRef: makeContainerRef(container),
                labels: LABELS,
            })
        );

        expect(
            container.querySelectorAll('.pane-indicator-label')
        ).toHaveLength(0);
    });

    it('does nothing when labels array is empty', () => {
        const container = document.createElement('div');
        const chart = makeChart();

        renderHook(() =>
            usePaneLabels({
                chartRef: makeChartRef(chart),
                containerRef: makeContainerRef(container),
                labels: [],
            })
        );

        expect(
            container.querySelectorAll('.pane-indicator-label')
        ).toHaveLength(0);
    });

    it('creates label elements in the container', () => {
        const container = document.createElement('div');
        const chart = makeChart();

        renderHook(() =>
            usePaneLabels({
                chartRef: makeChartRef(chart),
                containerRef: makeContainerRef(container),
                labels: LABELS,
            })
        );

        const labels = container.querySelectorAll('.pane-indicator-label');
        expect(labels).toHaveLength(1);
    });

    it('creates sub-label spans with correct text', () => {
        const container = document.createElement('div');
        const chart = makeChart();

        renderHook(() =>
            usePaneLabels({
                chartRef: makeChartRef(chart),
                containerRef: makeContainerRef(container),
                labels: LABELS,
            })
        );

        /* 서브라벨은 span 하나가 아니라 두 개다 — 바깥 span이 라벨 텍스트를,
           안쪽 span이 지표 색 점(●)을 담는다. 점에만 색을 칠해야 라이트
           테마에서 밝은 지표의 라벨이 읽히기 때문이다(`createSubLabelSpan` 참조). */
        const spans = container.querySelectorAll(
            '.pane-indicator-label > span'
        );
        expect(spans).toHaveLength(1);
        expect(spans[0].textContent).toContain('RSI');
        /* 점은 장식이므로 스크린리더에서 제외돼야 한다. */
        expect(
            spans[0].querySelector('span')?.getAttribute('aria-hidden')
        ).toBe('true');
    });

    it('cleans up labels on unmount', () => {
        const container = document.createElement('div');
        const chart = makeChart();

        const { unmount } = renderHook(() =>
            usePaneLabels({
                chartRef: makeChartRef(chart),
                containerRef: makeContainerRef(container),
                labels: LABELS,
            })
        );

        unmount();

        expect(
            container.querySelectorAll('.pane-indicator-label')
        ).toHaveLength(0);
    });

    /**
     * 부라벨은 **가로로** 놓이고 pane 높이로 잘려야 한다.
     *
     * 세로 스택이던 시절 MACD처럼 부라벨이 3개면 11px × 3 + 간격 6px × 2 = 45px가
     * 되어 36px짜리 보조 pane을 넘고 **아래 pane의 라벨과 겹쳐 찍혔다**
     * (모바일 500px 실측: `Histogram`과 `+DI(14)`가 한 줄에서 충돌).
     *
     * 두 속성을 함께 단언한다 — 방향만 보면 클램프가 사라져도 통과하고,
     * 클램프만 보면 세로로 되돌아가도 통과한다.
     */
    it('부라벨을 가로로 놓고 pane 높이로 자른다', () => {
        const container = document.createElement('div');
        renderHook(() =>
            usePaneLabels({
                chartRef: makeChartRef(makeChart()),
                containerRef: makeContainerRef(container),
                labels: LABELS,
            })
        );

        const el = container.querySelector<HTMLDivElement>(
            '.pane-indicator-label'
        );
        expect(el).not.toBeNull();
        expect(el?.style.flexDirection).toBe('row');
        expect(el?.style.flexWrap).toBe('wrap');
        expect(el?.style.overflow).toBe('hidden');
        // `LABELS`는 pane 1을 쓰고 목 높이가 100 — 상하 인셋 8px씩을 뺀 84px.
        expect(el?.style.maxHeight).toBe('84px');
    });
});
