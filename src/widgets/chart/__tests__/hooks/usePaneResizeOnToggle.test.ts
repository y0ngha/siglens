// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { usePaneResizeOnToggle } from '../../hooks/usePaneResizeOnToggle';
import {
    restoreVisibleView,
    snapshotVisibleView,
} from '../../utils/visibleViewSnapshot';
import type { PaneIndices } from '../../types';

vi.mock('../../utils/visibleViewSnapshot', () => ({
    snapshotVisibleView: vi.fn(() => ({
        fromTime: 1,
        toTime: 2,
        leftPad: 0,
        rightPad: 0,
    })),
    restoreVisibleView: vi.fn(() => true),
}));

const fitContent = vi.fn();
const chart = {
    applyOptions: vi.fn(),
    resize: vi.fn(),
    timeScale: () => ({ fitContent }),
};
const chartRef = { current: chart } as unknown as Parameters<
    typeof usePaneResizeOnToggle
>[0];
const wrapper = Object.assign(document.createElement('div'), {});
Object.defineProperty(wrapper, 'clientWidth', { value: 800 });
Object.defineProperty(wrapper, 'clientHeight', { value: 400 });
const wrapperRef = { current: wrapper };

const PANES_A = { rsi: -1 } as unknown as PaneIndices;
const PANES_B = { rsi: 1 } as unknown as PaneIndices;

describe('usePaneResizeOnToggle', () => {
    let frames: FrameRequestCallback[];
    beforeEach(() => {
        vi.clearAllMocks();
        frames = [];
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
            frames.push(cb);
            return frames.length;
        });
        vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    });

    it('첫 mount에서는 리사이즈하지 않는다', () => {
        renderHook(() => usePaneResizeOnToggle(chartRef, wrapperRef, PANES_A));
        expect(frames).toHaveLength(0);
    });

    it('패인이 바뀌면 리사이즈하고 보던 범위를 되돌린다(fitContent로 튀지 않는다)', () => {
        const { rerender } = renderHook(
            ({ panes }) => usePaneResizeOnToggle(chartRef, wrapperRef, panes),
            { initialProps: { panes: PANES_A } }
        );
        rerender({ panes: PANES_B });
        frames.splice(0).forEach(cb => cb(0));

        expect(chart.resize).toHaveBeenLastCalledWith(800, 400);
        expect(snapshotVisibleView).toHaveBeenCalled();
        expect(restoreVisibleView).toHaveBeenCalled();
        expect(fitContent).not.toHaveBeenCalled();
    });

    it('되돌릴 범위가 없으면 맞춤으로 폴백한다', () => {
        vi.mocked(snapshotVisibleView).mockReturnValueOnce(null);
        const { rerender } = renderHook(
            ({ panes }) => usePaneResizeOnToggle(chartRef, wrapperRef, panes),
            { initialProps: { panes: PANES_A } }
        );
        rerender({ panes: PANES_B });
        frames.splice(0).forEach(cb => cb(0));
        expect(fitContent).toHaveBeenCalled();
    });
});
