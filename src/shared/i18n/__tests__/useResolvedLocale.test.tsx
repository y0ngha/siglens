// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { useResolvedLocale } from '../useResolvedLocale';

function wrapperFor(locale: string) {
    return function Wrapper({ children }: { children: React.ReactNode }) {
        return (
            <NextIntlClientProvider locale={locale} messages={{}}>
                {children}
            </NextIntlClientProvider>
        );
    };
}

describe('useResolvedLocale', () => {
    it('지원하는 로케일이면 그대로 반환한다', () => {
        const { result } = renderHook(() => useResolvedLocale(), {
            wrapper: wrapperFor('ja'),
        });
        expect(result.current).toBe('ja');
    });

    /**
     * `useLocale()`의 반환값은 카탈로그에 없는 문자열일 수 있다(설정 오류·
     * 미들웨어 우회) — 그 자리에서 좁혀야 다운스트림이 `Locale` 타입을 안전하게
     * 쓸 수 있다.
     */
    it('카탈로그에 없는 로케일이면 기본 로케일(ko)로 좁힌다', () => {
        const { result } = renderHook(() => useResolvedLocale(), {
            wrapper: wrapperFor('xx'),
        });
        expect(result.current).toBe('ko');
    });
});
