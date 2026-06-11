// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersistentState } from '../usePersistentState';

describe('usePersistentState', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('returns initial value when nothing is stored', () => {
        const { result } = renderHook(() => usePersistentState('test.key', 42));
        expect(result.current[0]).toBe(42);
    });

    it('restores stored value after mount (useEffect fires in jsdom)', async () => {
        localStorage.setItem('test.restore', JSON.stringify({ count: 7 }));
        const { result } = renderHook(() =>
            usePersistentState('test.restore', { count: 0 })
        );
        // After effects run, the stored value should be restored
        expect(result.current[0]).toEqual({ count: 7 });
    });

    it('persists new value to localStorage on setValue change', () => {
        const { result } = renderHook(() =>
            usePersistentState('test.persist', 'initial')
        );

        act(() => {
            result.current[1]('updated');
        });

        expect(result.current[0]).toBe('updated');
        // After value changes (hydrated.current=true after mount effect), it should write
        expect(localStorage.getItem('test.persist')).toBe(
            JSON.stringify('updated')
        );
    });

    it('keeps initial value and does not throw on malformed JSON in localStorage', () => {
        localStorage.setItem('test.bad', 'NOT_VALID_JSON{{{');
        const { result } = renderHook(() =>
            usePersistentState('test.bad', 'fallback')
        );
        // Parsing fails silently — should retain initial
        expect(result.current[0]).toBe('fallback');
    });

    it('writes the initial value to localStorage once hydration completes', () => {
        // The write effect is gated on hydrated.current, which only flips true after the
        // mount effect runs — so during SSR (no effects) nothing is written, avoiding a
        // hydration mismatch. renderHook runs effects synchronously, so here we assert the
        // post-hydration outcome: the initial value lands in storage.
        localStorage.clear();
        renderHook(() => usePersistentState('test.nowrite', 99));
        expect(JSON.parse(localStorage.getItem('test.nowrite') ?? 'null')).toBe(
            99
        );
    });

    it('returns a stable setState function reference across rerenders', () => {
        const { result, rerender } = renderHook(() =>
            usePersistentState('test.stable', 0)
        );
        const firstSetter = result.current[1];
        rerender();
        expect(result.current[1]).toBe(firstSetter);
    });

    it('works with arrays as initial value', () => {
        localStorage.setItem('test.arr', JSON.stringify([1, 2, 3]));
        const { result } = renderHook(() =>
            usePersistentState<number[]>('test.arr', [])
        );
        expect(result.current[0]).toEqual([1, 2, 3]);
    });

    it('works with boolean initial value false', () => {
        const { result } = renderHook(() =>
            usePersistentState('test.bool', false)
        );
        expect(result.current[0]).toBe(false);

        act(() => {
            result.current[1](true);
        });
        expect(result.current[0]).toBe(true);
        expect(localStorage.getItem('test.bool')).toBe('true');
    });
});
