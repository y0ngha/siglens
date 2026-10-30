import { act, fireEvent, renderHook } from '@testing-library/react';
import { usePopoverDisclosure } from '../../hooks/usePopoverDisclosure';

describe('usePopoverDisclosure', () => {
    it('toggle로 열고 닫는다', () => {
        const { result } = renderHook(() => usePopoverDisclosure());

        act(() => result.current.toggle());
        expect(result.current.isOpen).toBe(true);

        act(() => result.current.toggle());
        expect(result.current.isOpen).toBe(false);
    });

    it('열려 있는 동안 Escape로 닫는다', () => {
        const { result } = renderHook(() => usePopoverDisclosure());
        act(() => result.current.toggle());

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(result.current.isOpen).toBe(false);
    });

    it('컨테이너 바깥 pointerdown으로 닫는다', () => {
        const { result } = renderHook(() => usePopoverDisclosure());
        result.current.containerRef.current = document.createElement('div');
        act(() => result.current.toggle());

        fireEvent.pointerDown(document.body);

        expect(result.current.isOpen).toBe(false);
    });
});
