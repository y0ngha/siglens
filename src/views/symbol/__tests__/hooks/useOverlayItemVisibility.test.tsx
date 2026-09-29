import { renderHook, act } from '@testing-library/react';
import { useOverlayItemVisibility } from '@/views/symbol/hooks/useOverlayItemVisibility';

describe('useOverlayItemVisibility', () => {
    it('starts with everything visible and no highlight', () => {
        const { result } = renderHook(() =>
            useOverlayItemVisibility('2026-09-29T00:00:00.000Z')
        );
        expect(result.current.hiddenKeys.size).toBe(0);
        expect(result.current.highlightedKey).toBeNull();
    });

    it('setVisible(keys, false) hides multiple keys at once; setVisible(keys, true) shows them again', () => {
        const { result } = renderHook(() =>
            useOverlayItemVisibility('2026-09-29T00:00:00.000Z')
        );

        act(() => {
            result.current.setVisible(['p1', 'p2'], false);
        });
        expect(result.current.hiddenKeys.has('p1')).toBe(true);
        expect(result.current.hiddenKeys.has('p2')).toBe(true);

        act(() => {
            result.current.setVisible(['p1'], true);
        });
        expect(result.current.hiddenKeys.has('p1')).toBe(false);
        expect(result.current.hiddenKeys.has('p2')).toBe(true);
    });

    it('setHighlighted sets the highlighted key; clearHighlighted only clears when it matches (idempotent)', () => {
        const { result } = renderHook(() =>
            useOverlayItemVisibility('2026-09-29T00:00:00.000Z')
        );

        act(() => {
            result.current.setHighlighted('p1');
        });
        expect(result.current.highlightedKey).toBe('p1');

        // 다른 key를 clear해도 아무 일도 없다(멱등 해제).
        act(() => {
            result.current.clearHighlighted('p2');
        });
        expect(result.current.highlightedKey).toBe('p1');

        act(() => {
            result.current.clearHighlighted('p1');
        });
        expect(result.current.highlightedKey).toBeNull();

        // 이미 해제된 key를 다시 clear해도 에러 없이 그대로 null.
        act(() => {
            result.current.clearHighlighted('p1');
        });
        expect(result.current.highlightedKey).toBeNull();
    });

    it('resets hiddenKeys and highlightedKey to defaults when analyzedAt changes', () => {
        const { result, rerender } = renderHook(
            ({ analyzedAt }) => useOverlayItemVisibility(analyzedAt),
            { initialProps: { analyzedAt: '2026-09-29T00:00:00.000Z' } }
        );

        act(() => {
            result.current.setVisible(['p1'], false);
            result.current.setHighlighted('p1');
        });
        expect(result.current.hiddenKeys.has('p1')).toBe(true);
        expect(result.current.highlightedKey).toBe('p1');

        rerender({ analyzedAt: '2026-09-29T01:00:00.000Z' });

        expect(result.current.hiddenKeys.size).toBe(0);
        expect(result.current.highlightedKey).toBeNull();
    });

    it('does not reset state when re-rendered with the same analyzedAt', () => {
        const { result, rerender } = renderHook(
            ({ analyzedAt }) => useOverlayItemVisibility(analyzedAt),
            { initialProps: { analyzedAt: '2026-09-29T00:00:00.000Z' } }
        );

        act(() => {
            result.current.setVisible(['p1'], false);
        });
        rerender({ analyzedAt: '2026-09-29T00:00:00.000Z' });

        expect(result.current.hiddenKeys.has('p1')).toBe(true);
    });
});
