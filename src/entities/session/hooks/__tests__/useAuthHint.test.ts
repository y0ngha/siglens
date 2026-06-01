// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { AUTH_HINT_COOKIE_NAME } from '@/shared/config/cookieNames';

// useHydrated는 jsdom에서 renderHook 직후 true를 반환하므로
// SSR 셸 일관성(false 반환) 테스트에선 hydration 전 상태를 직접 주입한다.
const mockUseHydrated = vi.fn<() => boolean>();
vi.mock('@/shared/hooks/useHydrated', () => ({
    useHydrated: () => mockUseHydrated(),
}));

import { useAuthHint } from '@/entities/session/hooks/useAuthHint';

function clearCookies() {
    for (const c of document.cookie.split('; ')) {
        const name = c.split('=')[0];
        if (name) document.cookie = `${name}=; max-age=0; path=/`;
    }
}

afterEach(() => {
    cleanup();
    clearCookies();
    vi.clearAllMocks();
});

describe('useAuthHint', () => {
    it('hydration 전(초기 render)에는 항상 false (SSR 셸 일관성)', () => {
        mockUseHydrated.mockReturnValue(false);
        document.cookie = `${AUTH_HINT_COOKIE_NAME}=1; path=/`;
        const { result } = renderHook(() => useAuthHint());
        // 초기 동기 render에서는 useHydrated=false → false
        expect(result.current).toBe(false);
    });

    it('hydration 후 hint 쿠키 값이 있으면 true', () => {
        mockUseHydrated.mockReturnValue(true);
        document.cookie = `${AUTH_HINT_COOKIE_NAME}=1; path=/`;
        const { result } = renderHook(() => useAuthHint());
        expect(result.current).toBe(true);
    });

    it('hydration 후 hint 쿠키 없으면 false', () => {
        mockUseHydrated.mockReturnValue(true);
        const { result } = renderHook(() => useAuthHint());
        expect(result.current).toBe(false);
    });

    it('hint 쿠키가 빈 값(siglens_auth=)이면 false (로그아웃으로 clear된 경우)', () => {
        mockUseHydrated.mockReturnValue(true);
        document.cookie = `${AUTH_HINT_COOKIE_NAME}=; path=/`;
        const { result } = renderHook(() => useAuthHint());
        expect(result.current).toBe(false);
    });
});
