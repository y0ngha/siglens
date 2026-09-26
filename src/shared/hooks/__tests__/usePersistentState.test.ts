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

    it('restores stored value after mount (useEffect fires in jsdom)', () => {
        localStorage.setItem('test.restore', JSON.stringify({ count: 7 }));
        const { result } = renderHook(() =>
            usePersistentState('test.restore', { count: 0 })
        );
        expect(result.current[0]).toEqual({ count: 7 });
        expect(
            JSON.parse(localStorage.getItem('test.restore') ?? 'null')
        ).toEqual({ count: 7 });
    });

    it('persists new value to localStorage on setValue change', () => {
        const { result } = renderHook(() =>
            usePersistentState('test.persist', 'initial')
        );

        act(() => {
            result.current[1]('updated');
        });

        expect(result.current[0]).toBe('updated');
        expect(localStorage.getItem('test.persist')).toBe(
            JSON.stringify('updated')
        );
    });

    it('keeps initial value and does not throw on malformed JSON in localStorage', () => {
        localStorage.setItem('test.bad', 'NOT_VALID_JSON{{{');
        const { result } = renderHook(() =>
            usePersistentState('test.bad', 'fallback')
        );
        expect(result.current[0]).toBe('fallback');
    });

    it('does not persist the initial value until it changes (writes only user changes)', () => {
        // 마운트 직후 첫 write effect는 건너뛰므로 initial은 저장되지 않는다 — 저장값을 잠깐
        // initial로 덮어쓰는 transient를 막고 localStorage엔 사용자 변경만 남긴다.
        const { result } = renderHook(() =>
            usePersistentState('test.nowrite', 99)
        );
        expect(localStorage.getItem('test.nowrite')).toBeNull();

        act(() => {
            result.current[1](100);
        });
        expect(JSON.parse(localStorage.getItem('test.nowrite') ?? 'null')).toBe(
            100
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

    it('falls back to initial when localStorage.getItem throws (Safari private mode)', () => {
        const getItem = vi
            .spyOn(Storage.prototype, 'getItem')
            .mockImplementation(() => {
                throw new DOMException('blocked', 'SecurityError');
            });
        try {
            const { result } = renderHook(() =>
                usePersistentState('test.getItemThrows', 'fallback-value')
            );
            expect(result.current[0]).toBe('fallback-value');
        } finally {
            getItem.mockRestore();
        }
    });

    it('keeps the new value in memory even when localStorage.setItem throws (quota exceeded)', () => {
        const setItem = vi
            .spyOn(Storage.prototype, 'setItem')
            .mockImplementation(() => {
                throw new DOMException('blocked', 'QuotaExceededError');
            });
        try {
            const { result } = renderHook(() =>
                usePersistentState('test.quota', 'initial')
            );
            act(() => {
                result.current[1]('updated-despite-quota');
            });
            expect(result.current[0]).toBe('updated-despite-quota');
        } finally {
            setItem.mockRestore();
        }
    });

    it('accepts a functional updater that reads the latest persisted value', () => {
        const { result } = renderHook(() =>
            usePersistentState('test.functional', 1)
        );
        act(() => {
            result.current[1](prev => prev + 1);
        });
        expect(result.current[0]).toBe(2);
        act(() => {
            result.current[1](prev => prev + 1);
        });
        expect(result.current[0]).toBe(3);
        expect(localStorage.getItem('test.functional')).toBe('3');
    });

    it('syncs across instances sharing the same key when one instance calls setValue', () => {
        const { result: resultA } = renderHook(() =>
            usePersistentState('test.crossInstance', 'a')
        );
        const { result: resultB } = renderHook(() =>
            usePersistentState('test.crossInstance', 'a')
        );

        act(() => {
            resultA.current[1]('changed-by-a');
        });

        expect(resultB.current[0]).toBe('changed-by-a');
    });

    /**
     * 다른 탭이 같은 key를 바꾸면 `storage` 이벤트가 발생한다. 이 훅은 그 이벤트를
     * 구독해 다음 스냅샷에서 새 값을 반영해야 한다 — 폴링 없이 탭 간 동기화되는 계약.
     */
    it('re-reads the value when a storage event fires for the same key from another tab', () => {
        const { result } = renderHook(() =>
            usePersistentState('test.crossTab', 'initial')
        );
        expect(result.current[0]).toBe('initial');

        act(() => {
            localStorage.setItem(
                'test.crossTab',
                JSON.stringify('changed-by-other-tab')
            );
            window.dispatchEvent(
                new StorageEvent('storage', {
                    key: 'test.crossTab',
                    newValue: JSON.stringify('changed-by-other-tab'),
                })
            );
        });

        expect(result.current[0]).toBe('changed-by-other-tab');
    });

    it('ignores storage events for unrelated keys', () => {
        const { result } = renderHook(() =>
            usePersistentState('test.crossTabIgnore', 'initial')
        );

        act(() => {
            localStorage.setItem('some.other.key', JSON.stringify('noise'));
            window.dispatchEvent(
                new StorageEvent('storage', {
                    key: 'some.other.key',
                    newValue: JSON.stringify('noise'),
                })
            );
        });

        expect(result.current[0]).toBe('initial');
    });

    it('unsubscribes its storage listener on unmount (no update after unmount)', () => {
        const { result, unmount } = renderHook(() =>
            usePersistentState('test.unmount', 'initial')
        );
        unmount();

        expect(() => {
            act(() => {
                localStorage.setItem(
                    'test.unmount',
                    JSON.stringify('after-unmount')
                );
                window.dispatchEvent(
                    new StorageEvent('storage', {
                        key: 'test.unmount',
                        newValue: JSON.stringify('after-unmount'),
                    })
                );
            });
        }).not.toThrow();
        expect(result.current[0]).toBe('initial');
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
