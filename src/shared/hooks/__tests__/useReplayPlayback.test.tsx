// @vitest-environment jsdom
import { renderHook, render, act } from '@testing-library/react';
import { useReplayPlayback } from '@/shared/hooks/useReplayPlayback';
import { useCanAnimate } from '@/shared/hooks/useCanAnimate';
import { completeFrame } from '@/shared/lib/replay/replayPlayer';
import {
    parseReplayLine,
    type ReplayScenario,
} from '@/shared/lib/replay/replayScript';

vi.mock('@/shared/hooks/useCanAnimate', () => ({
    useCanAnimate: vi.fn(),
}));

const mockUseCanAnimate = vi.mocked(useCanAnimate);

function makeScenario(id: string): ReplayScenario {
    return {
        id,
        question: 'ab',
        tools: [
            {
                label: 'Quote',
                pendingLabel: 'Checking quote',
                subject: 'AAA',
                ms: 50,
            },
        ],
        lines: [parseReplayLine('p', 'ab')],
        summary: 'Quote checked',
        sources: ['Quote'],
        asOf: 'as of close',
    };
}

const SCENARIOS = [makeScenario('s1'), makeScenario('s2')];

describe('useReplayPlayback', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mockUseCanAnimate.mockReturnValue(true);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('starts with the first scenario shown fully complete (SSR/first-paint match)', () => {
        mockUseCanAnimate.mockReturnValue(false);
        const { result } = renderHook(() => useReplayPlayback(SCENARIOS));

        expect(result.current.frame).toEqual(completeFrame(0));
        expect(result.current.paused).toBe(false);
    });

    it('does not start playback when reduced motion is preferred (animated: false)', () => {
        mockUseCanAnimate.mockReturnValue(false);
        const { result } = renderHook(() => useReplayPlayback(SCENARIOS));

        act(() => {
            vi.advanceTimersByTime(10_000);
        });

        expect(result.current.animated).toBe(false);
        // Frame never leaves the initial "complete" snapshot: no playback loop ran.
        expect(result.current.frame).toEqual(completeFrame(0));
    });

    it('advances the frame over time once playback starts (animated: true)', async () => {
        const { result } = renderHook(() => useReplayPlayback(SCENARIOS));

        await act(async () => {
            // Past FIRST_START_MS (300ms): typing should have begun.
            await vi.advanceTimersByTimeAsync(500);
        });

        expect(result.current.frame.typed).toBeGreaterThan(0);
    });

    it('togglePaused flips the paused flag and halts further progress', async () => {
        const { result } = renderHook(() => useReplayPlayback(SCENARIOS));

        act(() => {
            result.current.togglePaused();
        });
        expect(result.current.paused).toBe(true);

        const frameAtPause = result.current.frame;
        await act(async () => {
            await vi.advanceTimersByTimeAsync(5_000);
        });
        // Paused: no further progress despite time passing.
        expect(result.current.frame).toEqual(frameAtPause);

        act(() => {
            result.current.togglePaused();
        });
        expect(result.current.paused).toBe(false);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(500);
        });
        expect(result.current.frame).not.toEqual(frameAtPause);
    });

    it('scrolls the thread to the bottom whenever the frame changes', async () => {
        const { result } = renderHook(() => useReplayPlayback(SCENARIOS));
        const thread = document.createElement('div');
        Object.defineProperty(thread, 'scrollHeight', {
            value: 500,
            configurable: true,
        });
        (
            result.current.threadRef as { current: HTMLDivElement | null }
        ).current = thread;
        // Advancing time triggers a setFrame, which re-runs the scroll effect.
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500);
        });

        expect(thread.scrollTop).toBe(500);
    });

    it('cleans up pending timers on unmount without throwing', () => {
        const { unmount } = renderHook(() => useReplayPlayback(SCENARIOS));

        act(() => {
            vi.advanceTimersByTime(200);
        });

        expect(() => unmount()).not.toThrow();
    });

    it('observes intersection changes via rootRef and disconnects on unmount', () => {
        const observe = vi.fn();
        const disconnect = vi.fn();
        let capturedCallback: IntersectionObserverCallback | null = null;
        vi.stubGlobal(
            'IntersectionObserver',
            function MockIntersectionObserver(
                this: unknown,
                callback: IntersectionObserverCallback
            ) {
                capturedCallback = callback;
                return { observe, disconnect, unobserve: vi.fn() };
            }
        );

        function Harness() {
            const { rootRef } = useReplayPlayback(SCENARIOS);
            return <div ref={rootRef} />;
        }
        const { unmount } = render(<Harness />);

        expect(capturedCallback).not.toBeNull();
        expect(observe).toHaveBeenCalled();

        // Simulate the card scrolling off screen — exercised for coverage of the
        // observer callback itself (visibility gates playback timing).
        act(() => {
            capturedCallback?.(
                [{ isIntersecting: false } as IntersectionObserverEntry],
                {} as IntersectionObserver
            );
        });

        unmount();
        expect(disconnect).toHaveBeenCalled();

        vi.unstubAllGlobals();
    });
});
