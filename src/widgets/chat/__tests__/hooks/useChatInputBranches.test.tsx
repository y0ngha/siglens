/**
 * Branch coverage tests for useChatInput — targets uncovered branches in
 * handleKeyDown: Enter key, Shift+Enter, isComposing.
 */

// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import type { KeyboardEvent } from 'react';
import { useChatInput } from '../../hooks/useChatInput';

function makeOptions(
    overrides: Partial<Parameters<typeof useChatInput>[0]> = {}
) {
    return {
        messages: [],
        loadingPhase: null as null,
        isAnalysisReady: true,
        sendMessage: vi.fn(async () => {}),
        ...overrides,
    };
}

function makeKeyEvent(
    key: string,
    opts: { shiftKey?: boolean; isComposing?: boolean } = {}
): KeyboardEvent<HTMLTextAreaElement> {
    return {
        key,
        shiftKey: opts.shiftKey ?? false,
        nativeEvent: {
            isComposing: opts.isComposing ?? false,
        },
        preventDefault: vi.fn(),
    } as unknown as KeyboardEvent<HTMLTextAreaElement>;
}

describe('useChatInput — handleKeyDown branches', () => {
    it('prevents default and submits on Enter key', async () => {
        const sendMessage = vi.fn(async () => {});
        const { result } = renderHook(() =>
            useChatInput(makeOptions({ sendMessage }))
        );

        act(() => result.current.setInputValue('질문'));

        const event = makeKeyEvent('Enter');

        act(() => {
            result.current.handleKeyDown(event);
        });

        expect(event.preventDefault).toHaveBeenCalled();
    });

    it('does not submit on Shift+Enter', () => {
        const sendMessage = vi.fn(async () => {});
        const { result } = renderHook(() =>
            useChatInput(makeOptions({ sendMessage }))
        );

        act(() => result.current.setInputValue('질문'));

        const event = makeKeyEvent('Enter', { shiftKey: true });

        act(() => {
            result.current.handleKeyDown(event);
        });

        expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('does not submit when IME composing', () => {
        const sendMessage = vi.fn(async () => {});
        const { result } = renderHook(() =>
            useChatInput(makeOptions({ sendMessage }))
        );

        act(() => result.current.setInputValue('한글'));

        const event = makeKeyEvent('Enter', { isComposing: true });

        act(() => {
            result.current.handleKeyDown(event);
        });

        expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('does not submit on non-Enter key', () => {
        const sendMessage = vi.fn(async () => {});
        const { result } = renderHook(() =>
            useChatInput(makeOptions({ sendMessage }))
        );

        const event = makeKeyEvent('Tab');

        act(() => {
            result.current.handleKeyDown(event);
        });

        expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('does not submit when analysis not ready', async () => {
        const sendMessage = vi.fn(async () => {});
        const { result } = renderHook(() =>
            useChatInput(makeOptions({ sendMessage, isAnalysisReady: false }))
        );

        act(() => result.current.setInputValue('test'));

        await act(() => result.current.handleSubmit());

        expect(sendMessage).not.toHaveBeenCalled();
    });
});
