// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useBodyScrollLock } from '@/shared/hooks/useBodyScrollLock';

describe('useBodyScrollLock', () => {
    afterEach(() => {
        document.body.style.overflow = '';
    });

    it('locks while mounted and restores the previous value on unmount', () => {
        document.body.style.overflow = 'auto';
        const { unmount } = renderHook(() => useBodyScrollLock());
        expect(document.body.style.overflow).toBe('hidden');
        unmount();
        expect(document.body.style.overflow).toBe('auto');
    });

    it('does nothing while inactive and follows the active flag', () => {
        const { rerender, unmount } = renderHook(
            ({ active }) => useBodyScrollLock(active),
            { initialProps: { active: false } }
        );
        expect(document.body.style.overflow).toBe('');
        rerender({ active: true });
        expect(document.body.style.overflow).toBe('hidden');
        rerender({ active: false });
        expect(document.body.style.overflow).toBe('');
        unmount();
    });

    it('keeps the lock until the last owner releases it, in any order', () => {
        const first = renderHook(() => useBodyScrollLock());
        const second = renderHook(() => useBodyScrollLock());
        first.unmount();
        expect(document.body.style.overflow).toBe('hidden');
        second.unmount();
        expect(document.body.style.overflow).toBe('');
    });
});
