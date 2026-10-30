// @vitest-environment jsdom
import { fireEvent, renderHook } from '@testing-library/react';
import { useEscapeLayer } from '@/shared/hooks/useEscapeLayer';

describe('useEscapeLayer', () => {
    it('Escape에서 활성 레이어의 콜백을 호출한다', () => {
        const onEscape = vi.fn();
        renderHook(() => useEscapeLayer(onEscape, true));

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(onEscape).toHaveBeenCalledTimes(1);
    });

    it('다른 키에는 반응하지 않는다', () => {
        const onEscape = vi.fn();
        renderHook(() => useEscapeLayer(onEscape, true));

        fireEvent.keyDown(document, { key: 'Enter' });

        expect(onEscape).not.toHaveBeenCalled();
    });

    it('enabled가 false면 호출하지 않는다', () => {
        const onEscape = vi.fn();
        renderHook(() => useEscapeLayer(onEscape, false));

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(onEscape).not.toHaveBeenCalled();
    });

    it('한글 조합 중의 Escape는 무시한다', () => {
        const onEscape = vi.fn();
        renderHook(() => useEscapeLayer(onEscape, true));

        fireEvent.keyDown(document, { key: 'Escape', isComposing: true });

        expect(onEscape).not.toHaveBeenCalled();
    });

    it('언마운트 뒤에는 호출하지 않는다', () => {
        const onEscape = vi.fn();
        const { unmount } = renderHook(() => useEscapeLayer(onEscape, true));
        unmount();

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(onEscape).not.toHaveBeenCalled();
    });

    describe('레이어가 겹치면', () => {
        it('가장 나중에 열린 레이어만 닫는다', () => {
            const outer = vi.fn();
            const inner = vi.fn();
            renderHook(() => useEscapeLayer(outer, true));
            renderHook(() => useEscapeLayer(inner, true));

            fireEvent.keyDown(document, { key: 'Escape' });

            expect(inner).toHaveBeenCalledTimes(1);
            expect(outer).not.toHaveBeenCalled();
        });

        it('안쪽이 닫힌 뒤의 Escape는 바깥 레이어가 받는다', () => {
            const outer = vi.fn();
            const inner = vi.fn();
            renderHook(() => useEscapeLayer(outer, true));
            const innerHook = renderHook(() => useEscapeLayer(inner, true));

            innerHook.unmount();
            fireEvent.keyDown(document, { key: 'Escape' });

            expect(outer).toHaveBeenCalledTimes(1);
            expect(inner).not.toHaveBeenCalled();
        });

        it('바깥이 먼저 사라져도 안쪽 레이어는 유지된다', () => {
            const outer = vi.fn();
            const inner = vi.fn();
            const outerHook = renderHook(() => useEscapeLayer(outer, true));
            renderHook(() => useEscapeLayer(inner, true));

            outerHook.unmount();
            fireEvent.keyDown(document, { key: 'Escape' });

            expect(inner).toHaveBeenCalledTimes(1);
            expect(outer).not.toHaveBeenCalled();
        });
    });
});
