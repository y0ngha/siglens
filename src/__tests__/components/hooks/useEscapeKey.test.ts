/**
 * @jest-environment jsdom
 */
import { renderHook, fireEvent } from '@testing-library/react';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';

describe('useEscapeKey', () => {
    it('Escape 키 → callback 호출', () => {
        const onEscape = jest.fn();
        renderHook(() => useEscapeKey(onEscape, true));
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onEscape).toHaveBeenCalledTimes(1);
    });

    it('다른 키 → callback 호출 안 됨', () => {
        const onEscape = jest.fn();
        renderHook(() => useEscapeKey(onEscape, true));
        fireEvent.keyDown(document, { key: 'Enter' });
        expect(onEscape).not.toHaveBeenCalled();
    });

    it('enabled=false → Escape 키여도 callback 호출 안 됨', () => {
        const onEscape = jest.fn();
        renderHook(() => useEscapeKey(onEscape, false));
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onEscape).not.toHaveBeenCalled();
    });

    it('언마운트 후 → callback 호출 안 됨', () => {
        const onEscape = jest.fn();
        const { unmount } = renderHook(() => useEscapeKey(onEscape, true));
        unmount();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onEscape).not.toHaveBeenCalled();
    });
});
