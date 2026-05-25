// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { usePageShowReload } from '@/shared/hooks/usePageShowReload';

describe('usePageShowReload', () => {
    const originalReload = window.location.reload;

    beforeEach(() => {
        Object.defineProperty(window, 'location', {
            writable: true,
            value: { ...window.location, reload: vi.fn() },
        });
    });

    afterEach(() => {
        Object.defineProperty(window, 'location', {
            writable: true,
            value: { ...window.location, reload: originalReload },
        });
    });

    it('reloads when pageshow fires with persisted=true', () => {
        renderHook(() => usePageShowReload());
        const event = new PageTransitionEvent('pageshow', { persisted: true });
        window.dispatchEvent(event);
        expect(window.location.reload).toHaveBeenCalledTimes(1);
    });

    it('does not reload when pageshow fires with persisted=false', () => {
        renderHook(() => usePageShowReload());
        const event = new PageTransitionEvent('pageshow', { persisted: false });
        window.dispatchEvent(event);
        expect(window.location.reload).not.toHaveBeenCalled();
    });

    it('cleans up event listener on unmount', () => {
        const { unmount } = renderHook(() => usePageShowReload());
        unmount();
        const event = new PageTransitionEvent('pageshow', { persisted: true });
        window.dispatchEvent(event);
        expect(window.location.reload).not.toHaveBeenCalled();
    });
});
