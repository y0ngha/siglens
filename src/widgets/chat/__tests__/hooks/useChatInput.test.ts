// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';

import { useChatInput } from '../../hooks/useChatInput';

function makeOptions(
    overrides: Partial<Parameters<typeof useChatInput>[0]> = {}
) {
    return {
        messages: [],
        loadingPhase: null,
        isAnalysisReady: true,
        sendMessage: vi.fn(async () => {}),
        ...overrides,
    };
}

describe('useChatInput', () => {
    it('starts with empty input and not disabled', () => {
        const { result } = renderHook(() => useChatInput(makeOptions()));

        expect(result.current.inputValue).toBe('');
        expect(result.current.isInputDisabled).toBe(false);
    });

    it('is disabled when loadingPhase is non-null', () => {
        const { result } = renderHook(() =>
            useChatInput(makeOptions({ loadingPhase: 'analyzing' }))
        );

        expect(result.current.isInputDisabled).toBe(true);
    });

    it('is disabled when analysis is not ready', () => {
        const { result } = renderHook(() =>
            useChatInput(makeOptions({ isAnalysisReady: false }))
        );

        expect(result.current.isInputDisabled).toBe(true);
    });

    it('clears input and calls sendMessage on handleSubmit', async () => {
        const sendMessage = vi.fn(async () => {});
        const { result } = renderHook(() =>
            useChatInput(makeOptions({ sendMessage }))
        );

        act(() => result.current.setInputValue('질문입니다'));

        await act(() => result.current.handleSubmit());

        expect(sendMessage).toHaveBeenCalledWith('질문입니다');
        expect(result.current.inputValue).toBe('');
    });

    it('does not call sendMessage when input is whitespace-only', async () => {
        const sendMessage = vi.fn(async () => {});
        const { result } = renderHook(() =>
            useChatInput(makeOptions({ sendMessage }))
        );

        act(() => result.current.setInputValue('   '));

        await act(() => result.current.handleSubmit());

        expect(sendMessage).not.toHaveBeenCalled();
    });

    it('does not submit when loadingPhase is active', async () => {
        const sendMessage = vi.fn(async () => {});
        const { result } = renderHook(() =>
            useChatInput(
                makeOptions({ sendMessage, loadingPhase: 'generating' })
            )
        );

        act(() => result.current.setInputValue('hello'));

        await act(() => result.current.handleSubmit());

        expect(sendMessage).not.toHaveBeenCalled();
    });
});
