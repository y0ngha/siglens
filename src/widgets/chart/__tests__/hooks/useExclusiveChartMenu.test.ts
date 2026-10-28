// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import {
    useExclusiveChartMenu,
    type ChartMenuId,
} from '../../hooks/useExclusiveChartMenu';

const NONE: ReadonlySet<ChartMenuId> = new Set();
const OVERLAYS: ReadonlySet<ChartMenuId> = new Set(['overlays']);

describe('useExclusiveChartMenu', () => {
    it('하나를 열면 나머지는 닫힌다', () => {
        const { result } = renderHook(() => useExclusiveChartMenu());
        act(() => result.current.bind('indicators').toggle());
        act(() => result.current.bind('settings').toggle());
        expect(result.current.bind('indicators').isOpen).toBe(false);
        expect(result.current.bind('settings').isOpen).toBe(true);
    });

    // 렌더되지 않는 메뉴의 열림이 남으면, 내용이 다시 생길 때 누르지 않은 팝오버가 열린다.
    it('열린 메뉴가 쓸 수 없게 되면 닫고, 다시 쓸 수 있게 돼도 저절로 열리지 않는다', () => {
        const { result, rerender } = renderHook(
            ({ unavailable }) => useExclusiveChartMenu(unavailable),
            { initialProps: { unavailable: NONE } }
        );
        act(() => result.current.bind('overlays').toggle());
        expect(result.current.bind('overlays').isOpen).toBe(true);

        rerender({ unavailable: OVERLAYS });
        expect(result.current.bind('overlays').isOpen).toBe(false);

        rerender({ unavailable: NONE });
        expect(result.current.bind('overlays').isOpen).toBe(false);
    });
});
