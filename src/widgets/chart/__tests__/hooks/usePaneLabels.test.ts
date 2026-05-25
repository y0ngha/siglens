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

        const spans = container.querySelectorAll('.pane-indicator-label span');
        expect(spans).toHaveLength(1);
        expect(spans[0].textContent).toContain('RSI');
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
});
