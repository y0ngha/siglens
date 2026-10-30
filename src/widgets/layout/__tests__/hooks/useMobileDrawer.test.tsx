import { act, fireEvent, renderHook } from '@testing-library/react';
import { useMobileDrawer } from '../../hooks/useMobileDrawer';

describe('useMobileDrawer', () => {
    it('toggle로 열고 닫는다', () => {
        const { result } = renderHook(() => useMobileDrawer('/'));

        act(() => result.current.toggle());
        expect(result.current.isOpen).toBe(true);

        act(() => result.current.toggle());
        expect(result.current.isOpen).toBe(false);
    });

    it('열려 있는 동안 body 스크롤을 잠그고 닫으면 푼다', () => {
        const { result } = renderHook(() => useMobileDrawer('/'));

        act(() => result.current.toggle());
        expect(document.body.style.overflow).toBe('hidden');

        act(() => result.current.toggle());
        expect(document.body.style.overflow).not.toBe('hidden');
    });

    it('Escape로 닫는다', () => {
        const { result } = renderHook(() => useMobileDrawer('/'));
        act(() => result.current.toggle());

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(result.current.isOpen).toBe(false);
    });

    it('열려 있는 동안 경로가 바뀌면 닫는다', () => {
        const { result, rerender } = renderHook(
            ({ pathname }) => useMobileDrawer(pathname),
            { initialProps: { pathname: '/' } }
        );
        act(() => result.current.toggle());

        rerender({ pathname: '/news' });

        expect(result.current.isOpen).toBe(false);
    });

    it('닫혀 있을 때의 경로 변경은 열림 상태를 건드리지 않는다', () => {
        const { result, rerender } = renderHook(
            ({ pathname }) => useMobileDrawer(pathname),
            { initialProps: { pathname: '/' } }
        );

        rerender({ pathname: '/news' });

        expect(result.current.isOpen).toBe(false);
    });
});
