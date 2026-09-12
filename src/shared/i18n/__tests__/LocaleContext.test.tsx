// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import {
    LocaleProvider,
    useCurrentLocale,
    useHrefBase,
} from '@/shared/i18n/LocaleContext';

describe('useHrefBase', () => {
    it('프로바이더가 없으면 빈 문자열이다 — 메인 호스트의 기존 동작과 같다', () => {
        const { result } = renderHook(() => useHrefBase());
        expect(result.current).toBe('');
    });

    it('프로바이더가 hrefBase를 생략하면 빈 문자열이다', () => {
        const { result } = renderHook(() => useHrefBase(), {
            wrapper: ({ children }) => (
                <LocaleProvider locale="ko">{children}</LocaleProvider>
            ),
        });
        expect(result.current).toBe('');
    });

    it('프로바이더가 넘긴 hrefBase를 그대로 돌려준다', () => {
        const { result } = renderHook(() => useHrefBase(), {
            wrapper: ({ children }) => (
                <LocaleProvider locale="ko" hrefBase="https://siglens.io">
                    {children}
                </LocaleProvider>
            ),
        });
        expect(result.current).toBe('https://siglens.io');
    });

    it('locale과 hrefBase를 동시에 흘려보낸다', () => {
        const { result } = renderHook(
            () => ({ locale: useCurrentLocale(), base: useHrefBase() }),
            {
                wrapper: ({ children }) => (
                    <LocaleProvider locale="en" hrefBase="https://siglens.io">
                        {children}
                    </LocaleProvider>
                ),
            }
        );
        expect(result.current).toEqual({
            locale: 'en',
            base: 'https://siglens.io',
        });
    });
});
