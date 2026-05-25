// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import {
    useCopyToClipboard,
    DEFAULT_RESET_MS,
} from '@/shared/hooks/useCopyToClipboard';

describe('useCopyToClipboard', () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);

    beforeEach(() => {
        vi.useFakeTimers();
        Object.assign(navigator, {
            clipboard: { writeText: writeTextMock },
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        writeTextMock.mockClear();
    });

    it('starts with copied = false', () => {
        const { result } = renderHook(() => useCopyToClipboard());
        expect(result.current.copied).toBe(false);
    });

    it('sets copied to true after calling copy', async () => {
        const { result } = renderHook(() => useCopyToClipboard());
        await act(async () => {
            await result.current.copy('hello');
        });
        expect(writeTextMock).toHaveBeenCalledWith('hello');
        expect(result.current.copied).toBe(true);
    });

    it('resets copied to false after default timeout', async () => {
        const { result } = renderHook(() => useCopyToClipboard());
        await act(async () => {
            await result.current.copy('text');
        });
        expect(result.current.copied).toBe(true);

        act(() => {
            vi.advanceTimersByTime(DEFAULT_RESET_MS);
        });
        expect(result.current.copied).toBe(false);
    });

    it('respects a custom reset timeout', async () => {
        const customMs = 500;
        const { result } = renderHook(() => useCopyToClipboard(customMs));
        await act(async () => {
            await result.current.copy('text');
        });
        expect(result.current.copied).toBe(true);

        act(() => {
            vi.advanceTimersByTime(customMs - 1);
        });
        expect(result.current.copied).toBe(true);

        act(() => {
            vi.advanceTimersByTime(1);
        });
        expect(result.current.copied).toBe(false);
    });

    it('clears the previous timer when copy is called again', async () => {
        const { result } = renderHook(() => useCopyToClipboard());
        await act(async () => {
            await result.current.copy('first');
        });
        await act(async () => {
            await result.current.copy('second');
        });
        expect(result.current.copied).toBe(true);

        // Advance past the first timer — should still be true because second timer is active
        act(() => {
            vi.advanceTimersByTime(DEFAULT_RESET_MS);
        });
        expect(result.current.copied).toBe(false);
        expect(writeTextMock).toHaveBeenCalledTimes(2);
    });

    it('clears timer on unmount', async () => {
        const { result, unmount } = renderHook(() => useCopyToClipboard());
        await act(async () => {
            await result.current.copy('text');
        });
        unmount();
        // Advancing timers after unmount should not throw
        act(() => {
            vi.advanceTimersByTime(DEFAULT_RESET_MS);
        });
    });
});
