import { renderHook, act } from '@testing-library/react';
import { useDragListener } from '@/views/symbol/hooks/useDragListener';
import type React from 'react';

function startDrag(
    handleDragStart: (e: React.MouseEvent) => void,
    clientX: number
): void {
    act(() => {
        handleDragStart({
            button: 0,
            clientX,
            preventDefault: vi.fn(),
        } as unknown as React.MouseEvent);
    });
}

function move(clientX: number): void {
    act(() => {
        document.dispatchEvent(new MouseEvent('mousemove', { clientX }));
    });
}

describe('useDragListener', () => {
    beforeEach(() => {
        vi.useFakeTimers({
            toFake: ['requestAnimationFrame', 'cancelAnimationFrame'],
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

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
        act(() => {
            vi.advanceTimersToNextFrame();
        });

        expect(onResize).toHaveBeenCalledWith(50);
    });

    it('한 프레임 안의 여러 mousemove는 마지막 위치로 한 번만 넘긴다', () => {
        const onResize = vi.fn();
        const { result } = renderHook(() => useDragListener({ onResize }));
        startDrag(result.current.handleDragStart, 200);

        move(210);
        move(220);
        move(230);
        expect(onResize).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersToNextFrame();
        });

        expect(onResize).toHaveBeenCalledTimes(1);
        expect(onResize).toHaveBeenCalledWith(30);
    });

    it('손을 뗄 때 아직 반영 안 된 프레임을 즉시 반영한다', () => {
        const onResize = vi.fn();
        const { result } = renderHook(() => useDragListener({ onResize }));
        startDrag(result.current.handleDragStart, 200);

        move(260);
        act(() => {
            document.dispatchEvent(new MouseEvent('mouseup'));
        });

        expect(onResize).toHaveBeenCalledTimes(1);
        expect(onResize).toHaveBeenCalledWith(60);
        act(() => {
            vi.advanceTimersToNextFrame();
        });
        expect(onResize).toHaveBeenCalledTimes(1);
    });

    it('언마운트하면 대기 중인 프레임을 취소한다', () => {
        const onResize = vi.fn();
        const { result, unmount } = renderHook(() =>
            useDragListener({ onResize })
        );
        startDrag(result.current.handleDragStart, 200);

        move(260);
        unmount();
        act(() => {
            vi.advanceTimersToNextFrame();
        });

        expect(onResize).not.toHaveBeenCalled();
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
