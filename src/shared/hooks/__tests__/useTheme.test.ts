// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { useTheme } from '@/shared/hooks/useTheme';
import { THEME_ATTRIBUTE, THEME_STORAGE_KEY } from '@/shared/lib/theme';

describe('useTheme', () => {
    beforeEach(() => {
        localStorage.clear();
        document.documentElement.removeAttribute(THEME_ATTRIBUTE);
    });

    it('저장된 선택이 없으면 system을 돌려준다', () => {
        const { result } = renderHook(() => useTheme());
        expect(result.current.preference).toBe('system');
    });

    it('마운트 후 저장된 선택을 반영한다', () => {
        // 하이드레이션 직후 useSyncExternalStore가 실제 저장값으로 전환한다 —
        // 예전 구현은 같은 시점을 마운트 useEffect의 setState로 채웠다. 이 테스트는
        // 그 전환의 최종 결과만 본다(수단이 바뀌어도 계속 통과해야 한다).
        localStorage.setItem(THEME_STORAGE_KEY, 'dark');
        const { result } = renderHook(() => useTheme());
        expect(result.current.preference).toBe('dark');
    });

    it('setTheme(dark)는 저장하고 <html data-theme>를 갱신한다', () => {
        const { result } = renderHook(() => useTheme());

        act(() => result.current.setTheme('dark'));

        expect(result.current.preference).toBe('dark');
        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
        expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe(
            'dark'
        );
    });

    it('setTheme(system)은 저장된 키를 지운다', () => {
        localStorage.setItem(THEME_STORAGE_KEY, 'light');
        const { result } = renderHook(() => useTheme());

        act(() => result.current.setTheme('system'));

        expect(result.current.preference).toBe('system');
        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    });

    it('저장이 막혀도 고른 선택을 이번 세션 동안 유지한다', () => {
        // 사파리 비공개 모드처럼 setItem이 던지는 환경. 화면 테마는 바뀌는데 선택
        // 표시만 system으로 되돌아가면 안 된다.
        const setItem = vi
            .spyOn(Storage.prototype, 'setItem')
            .mockImplementation(() => {
                throw new DOMException('blocked', 'QuotaExceededError');
            });
        const { result } = renderHook(() => useTheme());

        act(() => result.current.setTheme('dark'));

        expect(result.current.preference).toBe('dark');
        expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe(
            'dark'
        );

        // 저장이 다시 되면 localStorage가 진실의 원천으로 돌아온다(다음 테스트로 새지 않게).
        setItem.mockRestore();
        act(() => result.current.setTheme('system'));
        expect(result.current.preference).toBe('system');
    });

    it('하이드레이션 렌더는 저장된 값이 있어도 서버 스냅샷(system)을 먼저 쓰고, 그 다음 저장된 값으로 전환한다', () => {
        // getServerPreferenceSnapshot이 하이드레이션 렌더에 쓰이지 않으면 서버가
        // 구운 HTML(system 기준)과 클라이언트 첫 렌더(dark 기준)가 어긋난다.
        localStorage.setItem(THEME_STORAGE_KEY, 'dark');
        const seen: string[] = [];

        renderHook(
            () => {
                const r = useTheme();
                seen.push(r.preference);
                return r;
            },
            { hydrate: true }
        );

        expect(seen[0]).toBe('system');
        expect(seen[seen.length - 1]).toBe('dark');
    });
});
