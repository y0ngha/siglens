/**
 * Tests for useHiddenDuration — 숨은 탭 누적 시간 측정.
 *
 * Date.now는 fake timers가 제어하고, visibilityState는 getter를 스파이해 바꾼다.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHiddenDuration } from '@/widgets/market-news/hooks/useHiddenDuration';

let visibility: 'visible' | 'hidden';

function setVisibility(next: 'visible' | 'hidden'): void {
    visibility = next;
    document.dispatchEvent(new Event('visibilitychange'));
}

describe('useHiddenDuration', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        visibility = 'visible';
        vi.spyOn(document, 'visibilityState', 'get').mockImplementation(
            () => visibility
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('숨겼다 다시 보이면 숨어 있던 시간만큼을 누적한다', () => {
        const { result } = renderHook(() => useHiddenDuration('a'));

        act(() => vi.advanceTimersByTime(1_000));
        act(() => setVisibility('hidden'));
        act(() => vi.advanceTimersByTime(5_000));
        act(() => setVisibility('visible'));
        act(() => vi.advanceTimersByTime(2_000));

        expect(result.current()).toBe(5_000);
    });

    it('여러 번 숨긴 시간을 합산한다', () => {
        const { result } = renderHook(() => useHiddenDuration('a'));

        act(() => setVisibility('hidden'));
        act(() => vi.advanceTimersByTime(3_000));
        act(() => setVisibility('visible'));
        act(() => vi.advanceTimersByTime(10_000));
        act(() => setVisibility('hidden'));
        act(() => vi.advanceTimersByTime(4_000));
        act(() => setVisibility('visible'));

        expect(result.current()).toBe(7_000);
    });

    it('숨겨진 채로 마운트되면 마운트 시점부터 숨은 시간으로 센다', () => {
        visibility = 'hidden';
        const { result } = renderHook(() => useHiddenDuration('a'));

        act(() => vi.advanceTimersByTime(4_000));
        act(() => setVisibility('visible'));
        act(() => vi.advanceTimersByTime(1_000));

        expect(result.current()).toBe(4_000);
    });

    it('아직 숨겨져 있는 동안 읽으면 진행 중인 구간까지 포함한다', () => {
        const { result } = renderHook(() => useHiddenDuration('a'));

        act(() => setVisibility('hidden'));
        act(() => vi.advanceTimersByTime(6_000));

        expect(result.current()).toBe(6_000);

        act(() => vi.advanceTimersByTime(1_000));

        expect(result.current()).toBe(7_000);
    });

    it('한 번도 숨기지 않았으면 0이다', () => {
        const { result } = renderHook(() => useHiddenDuration('a'));

        act(() => vi.advanceTimersByTime(60_000));

        expect(result.current()).toBe(0);
    });

    it('resetKey가 바뀌면 그때까지의 숨은 시간을 기준선으로 빼고 새로 센다', () => {
        const { result, rerender } = renderHook(
            ({ resetKey }: { resetKey: string }) => useHiddenDuration(resetKey),
            { initialProps: { resetKey: 'a' } }
        );

        act(() => setVisibility('hidden'));
        act(() => vi.advanceTimersByTime(5_000));
        act(() => setVisibility('visible'));
        expect(result.current()).toBe(5_000);

        rerender({ resetKey: 'b' });
        expect(result.current()).toBe(0);

        act(() => setVisibility('hidden'));
        act(() => vi.advanceTimersByTime(2_000));
        act(() => setVisibility('visible'));
        expect(result.current()).toBe(2_000);
    });

    it('숨겨진 채로 resetKey가 바뀌면 이후 구간만 센다', () => {
        const { result, rerender } = renderHook(
            ({ resetKey }: { resetKey: string }) => useHiddenDuration(resetKey),
            { initialProps: { resetKey: 'a' } }
        );

        act(() => setVisibility('hidden'));
        act(() => vi.advanceTimersByTime(5_000));
        rerender({ resetKey: 'b' });
        act(() => vi.advanceTimersByTime(3_000));

        expect(result.current()).toBe(3_000);
    });

    it('언마운트하면 visibilitychange 리스너를 제거한다', () => {
        const addSpy = vi.spyOn(document, 'addEventListener');
        const removeSpy = vi.spyOn(document, 'removeEventListener');
        const { unmount } = renderHook(() => useHiddenDuration('a'));

        const added = addSpy.mock.calls.find(
            ([type]) => type === 'visibilitychange'
        );
        expect(added).toBeDefined();

        unmount();

        expect(removeSpy).toHaveBeenCalledWith('visibilitychange', added?.[1]);
    });
});
