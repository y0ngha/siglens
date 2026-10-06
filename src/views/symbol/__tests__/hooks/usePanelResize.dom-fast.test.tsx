import { renderHook, act } from '@testing-library/react';
import {
    usePanelResize,
    PANEL_MIN_WIDTH,
    PANEL_MAX_WIDTH,
} from '@/views/symbol/hooks/usePanelResize';
import type React from 'react';

describe('usePanelResize', () => {
    // 드래그 반영은 프레임당 한 번이다(`useDragListener`) — 각 mousemove 뒤에 프레임을 넘긴다.
    beforeEach(() => {
        vi.useFakeTimers({
            toFake: ['requestAnimationFrame', 'cancelAnimationFrame'],
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('defaults panelWidth to PANEL_MAX_WIDTH', () => {
        const { result } = renderHook(() => usePanelResize());
        expect(result.current.panelWidth).toBe(PANEL_MAX_WIDTH);
    });

    it('defaults isDragging to false', () => {
        const { result } = renderHook(() => usePanelResize());
        expect(result.current.isDragging).toBe(false);
    });

    it('shrinks panel when dragged rightward (positive deltaX)', () => {
        const { result } = renderHook(() => usePanelResize());

        act(() => {
            result.current.handleDragStart({
                button: 0,
                clientX: 500,
                preventDefault: vi.fn(),
            } as unknown as React.MouseEvent);
        });

        act(() => {
            document.dispatchEvent(
                new MouseEvent('mousemove', { clientX: 600 })
            );
        });
        act(() => {
            vi.advanceTimersToNextFrame();
        });

        // deltaX = 600 - 500 = 100, panelWidth = 640 - 100 = 540
        expect(result.current.panelWidth).toBe(PANEL_MAX_WIDTH - 100);
    });

    it('clamps panel width to minimum', () => {
        const { result } = renderHook(() => usePanelResize());

        act(() => {
            result.current.handleDragStart({
                button: 0,
                clientX: 100,
                preventDefault: vi.fn(),
            } as unknown as React.MouseEvent);
        });

        act(() => {
            document.dispatchEvent(
                new MouseEvent('mousemove', { clientX: 2000 })
            );
        });
        act(() => {
            vi.advanceTimersToNextFrame();
        });

        expect(result.current.panelWidth).toBe(PANEL_MIN_WIDTH);
    });

    it('clamps panel width to maximum', () => {
        const { result } = renderHook(() => usePanelResize());

        act(() => {
            result.current.handleDragStart({
                button: 0,
                clientX: 500,
                preventDefault: vi.fn(),
            } as unknown as React.MouseEvent);
        });

        act(() => {
            document.dispatchEvent(
                new MouseEvent('mousemove', { clientX: -2000 })
            );
        });
        act(() => {
            vi.advanceTimersToNextFrame();
        });

        expect(result.current.panelWidth).toBe(PANEL_MAX_WIDTH);
    });

    it('폭이 최대에 걸려 그대로면 드래그 프레임이 와도 다시 렌더하지 않는다', () => {
        let renders = 0;
        const { result } = renderHook(() => {
            renders += 1;
            return usePanelResize();
        });
        act(() => {
            result.current.handleDragStart({
                button: 0,
                clientX: 500,
                preventDefault: vi.fn(),
            } as unknown as React.MouseEvent);
        });
        const rendersAfterDragStart = renders;

        for (const clientX of [400, 300, 200]) {
            act(() => {
                document.dispatchEvent(
                    new MouseEvent('mousemove', { clientX })
                );
            });
            act(() => {
                vi.advanceTimersToNextFrame();
            });
        }

        expect(result.current.panelWidth).toBe(PANEL_MAX_WIDTH);
        expect(renders).toBe(rendersAfterDragStart);
    });

    it('handles ArrowLeft to shrink panel', () => {
        const { result } = renderHook(() => usePanelResize());

        act(() => {
            result.current.handleKeyDown({
                key: 'ArrowLeft',
                preventDefault: vi.fn(),
            } as unknown as React.KeyboardEvent);
        });

        expect(result.current.panelWidth).toBe(PANEL_MAX_WIDTH - 10);
    });

    it('handles ArrowRight to grow panel', () => {
        const { result } = renderHook(() => usePanelResize());

        act(() => {
            result.current.handleKeyDown({
                key: 'ArrowLeft',
                preventDefault: vi.fn(),
            } as unknown as React.KeyboardEvent);
        });

        act(() => {
            result.current.handleKeyDown({
                key: 'ArrowRight',
                preventDefault: vi.fn(),
            } as unknown as React.KeyboardEvent);
        });

        expect(result.current.panelWidth).toBe(PANEL_MAX_WIDTH);
    });

    it('ignores non-arrow keys', () => {
        const { result } = renderHook(() => usePanelResize());
        const preventDefault = vi.fn();

        act(() => {
            result.current.handleKeyDown({
                key: 'Enter',
                preventDefault,
            } as unknown as React.KeyboardEvent);
        });

        expect(result.current.panelWidth).toBe(PANEL_MAX_WIDTH);
        expect(preventDefault).not.toHaveBeenCalled();
    });

    it('PANEL_MIN_WIDTH is less than PANEL_MAX_WIDTH', () => {
        expect(PANEL_MIN_WIDTH).toBeLessThan(PANEL_MAX_WIDTH);
    });
});
