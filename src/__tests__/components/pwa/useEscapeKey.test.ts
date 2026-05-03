/**
 * @jest-environment jsdom
 */
import { renderHook, fireEvent } from '@testing-library/react';
import { useEscapeKey } from '@/components/pwa/hooks/useEscapeKey';

describe('useEscapeKey', () => {
    it('Escape 키 → callback 호출', () => {
        const onEscape = jest.fn();
        renderHook(() => useEscapeKey(onEscape));
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(onEscape).toHaveBeenCalledTimes(1);
    });

    it('다른 키 → callback 호출 안 됨', () => {
        const onEscape = jest.fn();
        renderHook(() => useEscapeKey(onEscape));
        fireEvent.keyDown(window, { key: 'Enter' });
        expect(onEscape).not.toHaveBeenCalled();
    });

    it('언마운트 후 → callback 호출 안 됨', () => {
        const onEscape = jest.fn();
        const { unmount } = renderHook(() => useEscapeKey(onEscape));
        unmount();
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(onEscape).not.toHaveBeenCalled();
    });
});
