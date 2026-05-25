import { renderHook, act } from '@testing-library/react';
import { useActionPricesVisibility } from '@/widgets/symbol-page/hooks/useActionPricesVisibility';

describe('useActionPricesVisibility', () => {
    it('defaults to visible (true)', () => {
        const { result } = renderHook(() => useActionPricesVisibility());
        expect(result.current.actionPricesVisible).toBe(true);
    });

    it('toggles visibility to false', () => {
        const { result } = renderHook(() => useActionPricesVisibility());

        act(() => {
            result.current.setActionPricesVisible(false);
        });

        expect(result.current.actionPricesVisible).toBe(false);
    });

    it('toggles back to true', () => {
        const { result } = renderHook(() => useActionPricesVisibility());

        act(() => {
            result.current.setActionPricesVisible(false);
        });
        act(() => {
            result.current.setActionPricesVisible(true);
        });

        expect(result.current.actionPricesVisible).toBe(true);
    });

    it('supports functional updater', () => {
        const { result } = renderHook(() => useActionPricesVisibility());

        act(() => {
            result.current.setActionPricesVisible(prev => !prev);
        });

        expect(result.current.actionPricesVisible).toBe(false);
    });
});
