// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';

import {
    useChatButtonState,
    TOOLTIP_SHOWN_KEY,
} from '../../hooks/useChatButtonState';

describe('useChatButtonState', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('starts with isOpen=false and showTooltip=false', () => {
        const { result } = renderHook(() => useChatButtonState(false));

        expect(result.current.isOpen).toBe(false);
        expect(result.current.showTooltip).toBe(false);
    });

    it('toggles isOpen on handleButtonClick', () => {
        const { result } = renderHook(() => useChatButtonState(false));

        act(() => result.current.handleButtonClick());
        expect(result.current.isOpen).toBe(true);

        act(() => result.current.handleButtonClick());
        expect(result.current.isOpen).toBe(false);
    });

    it('sets isOpen to false on handleClose', () => {
        const { result } = renderHook(() => useChatButtonState(false));

        act(() => result.current.handleButtonClick());
        expect(result.current.isOpen).toBe(true);

        act(() => result.current.handleClose());
        expect(result.current.isOpen).toBe(false);
    });

    it('shows tooltip when analysis becomes ready and localStorage key is absent', () => {
        const { result, rerender } = renderHook(
            ({ ready }) => useChatButtonState(ready),
            { initialProps: { ready: false } }
        );

        expect(result.current.showTooltip).toBe(false);

        rerender({ ready: true });

        expect(result.current.showTooltip).toBe(true);
    });

    it('does not show tooltip if localStorage key already set', () => {
        localStorage.setItem(TOOLTIP_SHOWN_KEY, '1');

        const { result } = renderHook(() => useChatButtonState(true));

        expect(result.current.showTooltip).toBe(false);
    });

    it('sets localStorage key on dismissTooltip', () => {
        const { result, rerender } = renderHook(
            ({ ready }) => useChatButtonState(ready),
            { initialProps: { ready: false } }
        );

        rerender({ ready: true });
        expect(result.current.showTooltip).toBe(true);

        act(() => result.current.dismissTooltip());
        expect(result.current.showTooltip).toBe(false);
        expect(localStorage.getItem(TOOLTIP_SHOWN_KEY)).toBe('1');
    });

    it('dismisses tooltip when button is clicked while tooltip is visible', () => {
        const { result, rerender } = renderHook(
            ({ ready }) => useChatButtonState(ready),
            { initialProps: { ready: false } }
        );

        rerender({ ready: true });
        expect(result.current.showTooltip).toBe(true);

        act(() => result.current.handleButtonClick());

        expect(result.current.showTooltip).toBe(false);
        expect(result.current.isOpen).toBe(true);
    });
});
