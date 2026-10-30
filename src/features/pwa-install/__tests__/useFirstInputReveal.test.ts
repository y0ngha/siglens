// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { useFirstInputReveal } from '@/features/pwa-install/hooks/useFirstInputReveal';
import { POINTERUP_REVEAL_DELAY_MS } from '@/features/pwa-install/lib/bannerTriggers';
import { FIRST_INPUT_FLAG } from '@/features/pwa-install/lib/firstInputProbe';

describe('useFirstInputReveal', () => {
    afterEach(() => {
        vi.useRealTimers();
        Reflect.deleteProperty(window, FIRST_INPUT_FLAG);
    });

    it('입력 전에는 false', () => {
        const { result } = renderHook(() => useFirstInputReveal(true));
        expect(result.current).toBe(false);
    });

    it('첫 click에 true', () => {
        const { result } = renderHook(() => useFirstInputReveal(true));
        act(() => {
            window.dispatchEvent(new Event('click'));
        });
        expect(result.current).toBe(true);
    });

    it('enabled=false면 입력이 와도 false', () => {
        const { result } = renderHook(() => useFirstInputReveal(false));
        act(() => {
            window.dispatchEvent(new Event('click'));
        });
        expect(result.current).toBe(false);
    });

    it('enabled가 나중에 true가 되면 그때부터 듣는다', () => {
        const { result, rerender } = renderHook(
            ({ enabled }) => useFirstInputReveal(enabled),
            { initialProps: { enabled: false } }
        );
        rerender({ enabled: true });
        act(() => {
            window.dispatchEvent(new Event('keydown'));
        });
        expect(result.current).toBe(true);
    });

    it('pointerup만 오면 지연 뒤에 true', () => {
        vi.useFakeTimers();
        const { result } = renderHook(() => useFirstInputReveal(true));
        act(() => {
            window.dispatchEvent(new Event('pointerup'));
        });
        act(() => {
            vi.advanceTimersByTime(POINTERUP_REVEAL_DELAY_MS - 1);
        });
        expect(result.current).toBe(false);
        act(() => {
            vi.advanceTimersByTime(1);
        });
        expect(result.current).toBe(true);
    });

    it('하이드레이션 전 입력 플래그가 있으면 리스너 없이 true가 된다', () => {
        vi.useFakeTimers();
        Reflect.set(window, FIRST_INPUT_FLAG, true);
        const { result } = renderHook(() => useFirstInputReveal(true));
        act(() => {
            vi.advanceTimersByTime(0);
        });
        expect(result.current).toBe(true);
    });

    it('한 번 true가 되면 리스너를 모두 걷는다', () => {
        const removeEventListener = vi.spyOn(window, 'removeEventListener');
        renderHook(() => useFirstInputReveal(true));
        act(() => {
            window.dispatchEvent(new Event('click'));
        });
        const removed = removeEventListener.mock.calls.map(([type]) => type);
        removeEventListener.mockRestore();
        expect(removed).toEqual(
            expect.arrayContaining(['click', 'keydown', 'pointerup'])
        );
    });
});
