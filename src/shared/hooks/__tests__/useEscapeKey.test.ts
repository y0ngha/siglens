// @vitest-environment jsdom
import { renderHook, fireEvent } from '@testing-library/react';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';

describe('useEscapeKey', () => {
    it('Escape 키 → callback 호출', () => {
        const onEscape = vi.fn();
        renderHook(() => useEscapeKey(onEscape, true));
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onEscape).toHaveBeenCalledTimes(1);
    });

    it('다른 키 → callback 호출 안 됨', () => {
        const onEscape = vi.fn();
        renderHook(() => useEscapeKey(onEscape, true));
        fireEvent.keyDown(document, { key: 'Enter' });
        expect(onEscape).not.toHaveBeenCalled();
    });

    it('enabled=false → Escape 키여도 callback 호출 안 됨', () => {
        const onEscape = vi.fn();
        renderHook(() => useEscapeKey(onEscape, false));
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onEscape).not.toHaveBeenCalled();
    });

    it('언마운트 후 → callback 호출 안 됨', () => {
        const onEscape = vi.fn();
        const { unmount } = renderHook(() => useEscapeKey(onEscape, true));
        unmount();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onEscape).not.toHaveBeenCalled();
    });

    it('한글 조합 중의 Escape는 무시한다', () => {
        // 조합 중 Escape는 IME의 **취소 키**다. 그대로 닫으면 반쯤 조합한 음절을
        // 물리려던 사용자가 검색창째로 잃는다 — 한국어 입력이 주 사용자다.
        const onEscape = vi.fn();
        renderHook(() => useEscapeKey(onEscape, true));

        fireEvent.keyDown(document, { key: 'Escape', isComposing: true });

        expect(onEscape).not.toHaveBeenCalled();
    });
});
