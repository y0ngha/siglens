// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { useRestartOnHistoryRestore } from '@/features/auth-signup/hooks/useRestartOnHistoryRestore';

describe('useRestartOnHistoryRestore', () => {
    it('calls onRestore on popstate', () => {
        const onRestore = vi.fn();
        renderHook(() => useRestartOnHistoryRestore(onRestore));

        window.dispatchEvent(new PopStateEvent('popstate'));

        expect(onRestore).toHaveBeenCalledTimes(1);
    });

    it('calls onRestore on a bfcache pageshow', () => {
        const onRestore = vi.fn();
        renderHook(() => useRestartOnHistoryRestore(onRestore));

        window.dispatchEvent(
            new PageTransitionEvent('pageshow', { persisted: true })
        );

        expect(onRestore).toHaveBeenCalledTimes(1);
    });

    it('ignores a first-load pageshow', () => {
        const onRestore = vi.fn();
        renderHook(() => useRestartOnHistoryRestore(onRestore));

        window.dispatchEvent(
            new PageTransitionEvent('pageshow', { persisted: false })
        );

        expect(onRestore).not.toHaveBeenCalled();
    });

    it.each<[string, () => Event]>([
        ['popstate', () => new PopStateEvent('popstate')],
        [
            'pageshow',
            () => new PageTransitionEvent('pageshow', { persisted: true }),
        ],
    ])('stops listening for %s after unmount', (_type, makeEvent) => {
        const onRestore = vi.fn();
        const { unmount } = renderHook(() =>
            useRestartOnHistoryRestore(onRestore)
        );

        unmount();
        window.dispatchEvent(makeEvent());

        expect(onRestore).not.toHaveBeenCalled();
    });
});
