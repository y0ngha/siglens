import { renderHook } from '@testing-library/react';
import { THEME_ATTRIBUTE, THEME_STORAGE_KEY } from '@/shared/lib/theme';
import { useApplyStoredTheme } from '../../hooks/useApplyStoredTheme';

describe('useApplyStoredTheme', () => {
    afterEach(() => {
        window.localStorage.removeItem(THEME_STORAGE_KEY);
        document.documentElement.removeAttribute(THEME_ATTRIBUTE);
        document.documentElement.style.colorScheme = '';
    });

    it('저장된 테마를 마운트 때 <html>에 적용한다', () => {
        window.localStorage.setItem(THEME_STORAGE_KEY, 'light');

        renderHook(() => useApplyStoredTheme());

        expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe(
            'light'
        );
    });
});
