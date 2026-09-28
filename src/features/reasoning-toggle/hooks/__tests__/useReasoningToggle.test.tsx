import { renderHook, act, waitFor } from '@testing-library/react';
import { useReasoningToggle } from '@/features/reasoning-toggle/hooks/useReasoningToggle';
import { LOCAL_STORAGE_REASONING_KEY } from '@/shared/lib/storageKeys';

describe('useReasoningToggle', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('defaults to false (OFF)', () => {
        const { result } = renderHook(() => useReasoningToggle());
        expect(result.current[0]).toBe(false);
    });

    it('persists true to localStorage', () => {
        const { result } = renderHook(() => useReasoningToggle());

        act(() => {
            result.current[1](true);
        });

        expect(localStorage.getItem(LOCAL_STORAGE_REASONING_KEY)).toBe('true');
        expect(result.current[0]).toBe(true);
    });

    it('persists false to localStorage', () => {
        const { result } = renderHook(() => useReasoningToggle());

        act(() => {
            result.current[1](true);
        });
        act(() => {
            result.current[1](false);
        });

        expect(localStorage.getItem(LOCAL_STORAGE_REASONING_KEY)).toBe('false');
        expect(result.current[0]).toBe(false);
    });

    it('reads a stored true value from localStorage after hydration', async () => {
        localStorage.setItem(LOCAL_STORAGE_REASONING_KEY, 'true');

        const { result } = renderHook(() => useReasoningToggle());

        await waitFor(() => {
            expect(result.current[2]).toBe(true);
        });

        expect(result.current[0]).toBe(true);
    });

    it('resolves to false when localStorage has no stored value', async () => {
        const { result } = renderHook(() => useReasoningToggle());

        await waitFor(() => {
            expect(result.current[2]).toBe(true);
        });

        expect(result.current[0]).toBe(false);
    });

    it('becomes hydrated after the mount effect runs', async () => {
        const { result } = renderHook(() => useReasoningToggle());

        await waitFor(() => {
            expect(result.current[2]).toBe(true);
        });
    });

    /**
     * 회귀: 저장소가 막힌 브라우저(시크릿 모드·Safari 사생활 보호)는 `localStorage`
     * 접근에서 `SecurityError`를 던진다. 가드가 없으면 마운트 effect/토글 핸들러가
     * 그대로 던져 트리가 죽었다.
     */
    describe('when localStorage throws (storage blocked)', () => {
        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('hydrates to the default instead of throwing on read', async () => {
            vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
                throw new DOMException('blocked', 'SecurityError');
            });
            const { result } = renderHook(() => useReasoningToggle());

            await waitFor(() => {
                expect(result.current[2]).toBe(true);
            });
            expect(result.current[0]).toBe(false);
        });

        it('still updates in-session state when the write throws', () => {
            vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
                throw new DOMException('blocked', 'SecurityError');
            });
            const { result } = renderHook(() => useReasoningToggle());

            act(() => {
                result.current[1](true);
            });
            expect(result.current[0]).toBe(true);
        });
    });
});
