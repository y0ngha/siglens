import { act, renderHook } from '@testing-library/react';
import { startTransition } from 'react';
import { useThemeVersion } from '@/shared/hooks/useThemeVersion';
import { THEME_CHANGE_EVENT } from '@/shared/lib/theme';

vi.mock('react', async importOriginal => {
    const actual = await importOriginal<typeof import('react')>();
    return {
        ...actual,
        startTransition: vi.fn((callback: () => void) =>
            actual.startTransition(callback)
        ),
    };
});

function emitThemeChange(): void {
    act(() => {
        window.dispatchEvent(
            new CustomEvent(THEME_CHANGE_EVENT, { detail: 'light' })
        );
    });
}

describe('useThemeVersion', () => {
    beforeEach(() => {
        vi.mocked(startTransition).mockClear();
    });

    it('테마 변경 이벤트마다 1씩 오른다', () => {
        const { result } = renderHook(() => useThemeVersion());
        expect(result.current).toBe(0);

        emitThemeChange();
        emitThemeChange();

        expect(result.current).toBe(2);
    });

    it('증가를 transition으로 넘겨 차트 remount가 클릭 페인트를 막지 않게 한다', () => {
        renderHook(() => useThemeVersion());

        emitThemeChange();

        expect(startTransition).toHaveBeenCalledTimes(1);
    });

    it('언마운트 뒤에는 이벤트를 듣지 않는다', () => {
        const { unmount } = renderHook(() => useThemeVersion());
        unmount();

        emitThemeChange();

        expect(startTransition).not.toHaveBeenCalled();
    });
});
