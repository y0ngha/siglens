const { mockReplace, mockPathname } = vi.hoisted(() => ({
    mockReplace: vi.fn(),
    mockPathname: vi.fn(() => '/AAPL/news'),
}));
vi.mock('@/shared/i18n/navigation', () => ({
    usePathname: mockPathname,
    useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
}));

import { act, renderHook } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { useLocaleSwitch } from '../../hooks/useLocaleSwitch';

const wrapper = ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider locale="ko" messages={{}}>
        {children}
    </NextIntlClientProvider>
);

describe('useLocaleSwitch', () => {
    afterEach(() => {
        window.history.replaceState(null, '', '/');
        mockReplace.mockClear();
    });

    it('현재 로케일을 돌려준다', () => {
        const { result } = renderHook(() => useLocaleSwitch(), { wrapper });

        expect(result.current.locale).toBe('ko');
    });

    it('다른 로케일을 고르면 쿼리·해시를 유지한 채 replace한다', () => {
        window.history.replaceState(null, '', '/AAPL/news?tf=1Hour#chart');
        const { result } = renderHook(() => useLocaleSwitch(), { wrapper });

        act(() => result.current.select('ja'));

        expect(mockReplace).toHaveBeenCalledWith('/AAPL/news?tf=1Hour#chart', {
            locale: 'ja',
        });
    });

    it('현재 로케일을 다시 고르면 이동하지 않는다', () => {
        const { result } = renderHook(() => useLocaleSwitch(), { wrapper });

        act(() => result.current.select('ko'));

        expect(mockReplace).not.toHaveBeenCalled();
    });
});
