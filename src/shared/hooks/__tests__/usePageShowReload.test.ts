// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { usePageShowReload } from '@/shared/hooks/usePageShowReload';
import { pageReload } from '@/shared/lib/pageReload';

vi.mock('@/shared/lib/pageReload', () => ({
    pageReload: vi.fn(),
}));

function makePageShowEvent(persisted: boolean) {
    const event = new Event('pageshow') as PageTransitionEvent;
    Object.defineProperty(event, 'persisted', { value: persisted });
    return event;
}

describe('usePageShowReload', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('reloads when pageshow fires with persisted=true', () => {
        renderHook(() => usePageShowReload());
        window.dispatchEvent(makePageShowEvent(true));
        expect(pageReload).toHaveBeenCalledTimes(1);
    });

    it('does not reload when pageshow fires with persisted=false', () => {
        renderHook(() => usePageShowReload());
        window.dispatchEvent(makePageShowEvent(false));
        expect(pageReload).not.toHaveBeenCalled();
    });

    it('cleans up event listener on unmount', () => {
        const { unmount } = renderHook(() => usePageShowReload());
        unmount();
        window.dispatchEvent(makePageShowEvent(true));
        expect(pageReload).not.toHaveBeenCalled();
    });
});
