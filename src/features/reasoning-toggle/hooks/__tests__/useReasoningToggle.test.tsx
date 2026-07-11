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
});
