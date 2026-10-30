// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { useSymbolNavigation } from '@/features/ticker-search/hooks/useSymbolNavigation';
import type { Locale } from '@/shared/i18n/locales';
import { assignLocation } from '@/shared/lib/crossHostNavigate';

const mockPush = vi.fn();
const mockPrefetch = vi.fn();

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: mockPush,
        replace: vi.fn(),
        prefetch: mockPrefetch,
    }),
}));

vi.mock('@/shared/lib/crossHostNavigate', () => ({
    assignLocation: vi.fn(),
    replaceLocation: vi.fn(),
}));

const localeState: { locale: Locale; hrefBase: string } = {
    locale: 'ko',
    hrefBase: '',
};
vi.mock('@/shared/i18n/LocaleContext', async () => {
    const actual = await vi.importActual<
        typeof import('@/shared/i18n/LocaleContext')
    >('@/shared/i18n/LocaleContext');
    return {
        ...actual,
        useCurrentLocale: () => localeState.locale,
        useHrefBase: () => localeState.hrefBase,
    };
});

describe('useSymbolNavigation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localeState.locale = 'ko';
        localeState.hrefBase = '';
    });

    describe('goToSymbol', () => {
        it('같은 호스트에서는 로케일 경로로 router.push 한다', () => {
            localeState.locale = 'en';
            const { result } = renderHook(() => useSymbolNavigation());

            result.current.goToSymbol('AAPL');

            expect(mockPush).toHaveBeenCalledWith('/en/AAPL');
            expect(assignLocation).not.toHaveBeenCalled();
        });

        it('hrefBase가 있으면 router 대신 크로스 호스트 이동을 한다', () => {
            localeState.hrefBase = 'https://siglens.io';
            const { result } = renderHook(() => useSymbolNavigation());

            result.current.goToSymbol('AAPL');

            expect(assignLocation).toHaveBeenCalledWith(
                'https://siglens.io/AAPL'
            );
            expect(mockPush).not.toHaveBeenCalled();
        });
    });

    describe('prefetchSymbol', () => {
        it('로케일 경로를 prefetch 한다', () => {
            localeState.locale = 'en';
            const { result } = renderHook(() => useSymbolNavigation());

            result.current.prefetchSymbol('AAPL');

            expect(mockPrefetch).toHaveBeenCalledWith('/en/AAPL');
        });

        it('같은 심볼은 한 번만 prefetch 한다', () => {
            const { result } = renderHook(() => useSymbolNavigation());

            result.current.prefetchSymbol('AAPL');
            result.current.prefetchSymbol('AAPL');
            result.current.prefetchSymbol('NVDA');

            expect(mockPrefetch).toHaveBeenCalledTimes(2);
        });

        it('hrefBase가 있으면 prefetch 하지 않는다', () => {
            localeState.hrefBase = 'https://siglens.io';
            const { result } = renderHook(() => useSymbolNavigation());

            result.current.prefetchSymbol('AAPL');

            expect(mockPrefetch).not.toHaveBeenCalled();
        });
    });
});
