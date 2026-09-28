// @vitest-environment jsdom
import type { RefObject } from 'react';
import { renderHook } from '@testing-library/react';
import type { ISeriesApi } from 'lightweight-charts';
import { useBandOccluder } from '../../hooks/useBandOccluder';
import { THEME_CHANGE_EVENT } from '@/shared/lib/theme';

const mockGetChartChrome = vi.fn(() => ({
    background: '#1a1a2e',
    grid: '#2a2a3e',
    text: '#a0a0b0',
}));

vi.mock('@/shared/lib/chartColors', () => ({
    getChartChrome: () => mockGetChartChrome(),
}));

function makeSeriesRef(series: unknown = null) {
    return { current: series } as RefObject<ISeriesApi<'Area'> | null>;
}

describe('useBandOccluder', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not touch series options until the theme actually changes', () => {
        const mockApplyOptions = vi.fn();
        renderHook(() =>
            useBandOccluder(makeSeriesRef({ applyOptions: mockApplyOptions }))
        );

        expect(mockApplyOptions).not.toHaveBeenCalled();
    });

    /**
     * 밴드형 오버레이의 하단 시리즈는 **마스크**(투명하면 상단 틴트가 pane
     * 바닥까지 번짐) — 테마 전환 시 배경색으로 top/bottom 둘 다 다시 칠해야
     * 한다. 값 하나만 바뀌어도 밴드가 깨지므로 실제 색상 값까지 고정한다.
     */
    it('re-paints top/bottom fill with the current theme background on THEME_CHANGE_EVENT', () => {
        const mockApplyOptions = vi.fn();
        renderHook(() =>
            useBandOccluder(makeSeriesRef({ applyOptions: mockApplyOptions }))
        );

        window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT));

        expect(mockApplyOptions).toHaveBeenCalledWith({
            topColor: '#1a1a2e',
            bottomColor: '#1a1a2e',
        });
    });

    it('reads the theme lazily on each event — light/dark switches pick up the new background', () => {
        const mockApplyOptions = vi.fn();
        renderHook(() =>
            useBandOccluder(makeSeriesRef({ applyOptions: mockApplyOptions }))
        );

        mockGetChartChrome.mockReturnValue({
            background: '#ffffff',
            grid: '#e5e5e5',
            text: '#111111',
        });
        window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT));

        expect(mockApplyOptions).toHaveBeenCalledWith({
            topColor: '#ffffff',
            bottomColor: '#ffffff',
        });
    });

    it('does nothing when the series ref is null at event time', () => {
        renderHook(() => useBandOccluder(makeSeriesRef(null)));

        // series가 없으면 적용할 대상이 없다 — 이벤트를 던져도 에러 없이 무시돼야 한다.
        expect(() =>
            window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT))
        ).not.toThrow();
    });

    it('removes the listener on unmount — a stale series is never touched again', () => {
        const mockApplyOptions = vi.fn();
        const { unmount } = renderHook(() =>
            useBandOccluder(makeSeriesRef({ applyOptions: mockApplyOptions }))
        );

        unmount();
        window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT));

        expect(mockApplyOptions).not.toHaveBeenCalled();
    });
});
