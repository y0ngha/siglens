import { renderHook, act } from '@testing-library/react';
import { useDragListener } from '@/views/symbol/hooks/useDragListener';
import type React from 'react';

describe('useDragListener', () => {
    it('starts with isDragging false', () => {
        const onResize = vi.fn();
        const { result } = renderHook(() => useDragListener({ onResize }));
        expect(result.current.isDragging).toBe(false);
    });

    it('ignores non-left-button clicks', () => {
        const onResize = vi.fn();
        const { result } = renderHook(() => useDragListener({ onResize }));

        const event = {
            button: 2,
            clientX: 100,
            preventDefault: vi.fn(),
        } as unknown as React.MouseEvent;

        act(() => {
            result.current.handleDragStart(event);
        });

        expect(result.current.isDragging).toBe(false);
        expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('sets isDragging to true on left-button mouse down', () => {
        const onResize = vi.fn();
        const { result } = renderHook(() => useDragListener({ onResize }));

        const event = {
            button: 0,
            clientX: 100,
            preventDefault: vi.fn(),
        } as unknown as React.MouseEvent;

        act(() => {
            result.current.handleDragStart(event);
        });

        expect(result.current.isDragging).toBe(true);
        expect(event.preventDefault).toHaveBeenCalled();
    });

    it('calls onResize with delta during mousemove', () => {
        const onResize = vi.fn();
        const { result } = renderHook(() => useDragListener({ onResize }));

        act(() => {
            result.current.handleDragStart({
                button: 0,
                clientX: 200,
                preventDefault: vi.fn(),
            } as unknown as React.MouseEvent);
        });

        act(() => {
            document.dispatchEvent(
                new MouseEvent('mousemove', { clientX: 250 })
            );
        });

        expect(onResize).toHaveBeenCalledWith(50);
    });

    it('sets isDragging to false on mouseup', () => {
        const onResize = vi.fn();
        const { result } = renderHook(() => useDragListener({ onResize }));

        act(() => {
            result.current.handleDragStart({
                button: 0,
                clientX: 100,
                preventDefault: vi.fn(),
            } as unknown as React.MouseEvent);
        });

        expect(result.current.isDragging).toBe(true);

        act(() => {
            document.dispatchEvent(new MouseEvent('mouseup'));
        });

        expect(result.current.isDragging).toBe(false);
    });

    it('removes listeners on unmount', () => {
        const onResize = vi.fn();
        const removeSpy = vi.spyOn(document, 'removeEventListener');

        const { result, unmount } = renderHook(() =>
            useDragListener({ onResize })
        );

        act(() => {
            result.current.handleDragStart({
                button: 0,
                clientX: 100,
                preventDefault: vi.fn(),
            } as unknown as React.MouseEvent);
        });

        unmount();

        const removedEvents = removeSpy.mock.calls.map(c => c[0]);
        expect(removedEvents).toContain('mousemove');
        expect(removedEvents).toContain('mouseup');

        removeSpy.mockRestore();
    });
});
