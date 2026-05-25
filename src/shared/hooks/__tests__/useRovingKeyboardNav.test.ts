// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import type { KeyboardEvent } from 'react';
import { useRovingKeyboardNav } from '@/shared/hooks/useRovingKeyboardNav';

function makeKeyEvent(key: string): KeyboardEvent<Element> {
    return {
        key,
        preventDefault: vi.fn(),
    } as unknown as KeyboardEvent<Element>;
}

describe('useRovingKeyboardNav', () => {
    const items = ['a', 'b', 'c'] as const;
    const onChange = vi.fn();
    const focusItem = vi.fn();

    beforeEach(() => {
        onChange.mockClear();
        focusItem.mockClear();
    });

    it('navigates right with ArrowRight (wraps around)', () => {
        const { result } = renderHook(() =>
            useRovingKeyboardNav({
                items,
                activeItem: 'c',
                onChange,
                focusItem,
            })
        );
        const event = makeKeyEvent('ArrowRight');
        result.current(event);
        expect(onChange).toHaveBeenCalledWith('a');
        expect(focusItem).toHaveBeenCalledWith('a', event);
        expect(event.preventDefault).toHaveBeenCalled();
    });

    it('navigates left with ArrowLeft (wraps around)', () => {
        const { result } = renderHook(() =>
            useRovingKeyboardNav({
                items,
                activeItem: 'a',
                onChange,
                focusItem,
            })
        );
        const event = makeKeyEvent('ArrowLeft');
        result.current(event);
        expect(onChange).toHaveBeenCalledWith('c');
        expect(focusItem).toHaveBeenCalledWith('c', event);
    });

    it('navigates to first item with Home', () => {
        const { result } = renderHook(() =>
            useRovingKeyboardNav({
                items,
                activeItem: 'c',
                onChange,
                focusItem,
            })
        );
        const event = makeKeyEvent('Home');
        result.current(event);
        expect(onChange).toHaveBeenCalledWith('a');
    });

    it('navigates to last item with End', () => {
        const { result } = renderHook(() =>
            useRovingKeyboardNav({
                items,
                activeItem: 'a',
                onChange,
                focusItem,
            })
        );
        const event = makeKeyEvent('End');
        result.current(event);
        expect(onChange).toHaveBeenCalledWith('c');
    });

    it('ignores Home/End when withHomeEnd is false', () => {
        const { result } = renderHook(() =>
            useRovingKeyboardNav({
                items,
                activeItem: 'b',
                onChange,
                focusItem,
                withHomeEnd: false,
            })
        );
        const homeEvent = makeKeyEvent('Home');
        result.current(homeEvent);
        expect(onChange).not.toHaveBeenCalled();
        expect(homeEvent.preventDefault).not.toHaveBeenCalled();

        const endEvent = makeKeyEvent('End');
        result.current(endEvent);
        expect(onChange).not.toHaveBeenCalled();
    });

    it('ignores unrelated keys', () => {
        const { result } = renderHook(() =>
            useRovingKeyboardNav({
                items,
                activeItem: 'b',
                onChange,
                focusItem,
            })
        );
        const event = makeKeyEvent('Enter');
        result.current(event);
        expect(onChange).not.toHaveBeenCalled();
        expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('does nothing when activeItem is not in items', () => {
        const { result } = renderHook(() =>
            useRovingKeyboardNav({
                items,
                activeItem: 'z' as string,
                onChange,
                focusItem,
            })
        );
        const event = makeKeyEvent('ArrowRight');
        result.current(event);
        expect(onChange).not.toHaveBeenCalled();
    });
});
