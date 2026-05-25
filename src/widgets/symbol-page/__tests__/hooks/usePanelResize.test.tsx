import { renderHook, act } from '@testing-library/react';
import {
    usePanelResize,
    PANEL_MIN_WIDTH,
    PANEL_MAX_WIDTH,
} from '@/widgets/symbol-page/hooks/usePanelResize';
import type React from 'react';

describe('usePanelResize', () => {
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

        expect(result.current.panelWidth).toBe(PANEL_MAX_WIDTH);
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
