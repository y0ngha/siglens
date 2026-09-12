'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { DEFAULT_LOCALE, type Locale } from './locales';

/**
 * 현재 로케일을 클라이언트 트리에 흘려보내는 컨텍스트.
 *
 * **왜 `useLocale()`(next-intl)이나 `usePathname()`이 아닌가**: 둘 다 "없으면
 * 던지거나 mock을 요구한다". `useLocale()`은 `NextIntlClientProvider` 밖에서
 * 던지고, `usePathname()`은 `next/navigation`을 부분 mock한 기존 테스트에서
 * "export가 없다"로 실패한다. 링크는 앱 전역에 있으므로 어느 쪽이든 수백 개
 * 테스트를 인질로 잡는다.
 *
 * 기본값이 있는 평범한 React 컨텍스트는 **프로바이더가 없어도 던지지 않는다** —
 * 조각 렌더 테스트는 기본 로케일로 조용히 동작하고, 런타임에는 루트 레이아웃이
 * 실제 값을 넣는다.
 */
interface LocaleContextValue {
    readonly locale: Locale;
    readonly hrefBase: string;
}

const LocaleContext = createContext<LocaleContextValue>({
    locale: DEFAULT_LOCALE,
    hrefBase: '',
});

export function LocaleProvider({
    locale,
    hrefBase = '',
    children,
}: {
    readonly locale: Locale;
    readonly hrefBase?: string;
    readonly children: ReactNode;
}) {
    const value = useMemo(() => ({ locale, hrefBase }), [locale, hrefBase]);
    return (
        <LocaleContext.Provider value={value}>
            {children}
        </LocaleContext.Provider>
    );
}

/** 현재 로케일. 프로바이더가 없으면 기본 로케일. */
export function useCurrentLocale(): Locale {
    return useContext(LocaleContext).locale;
}

/**
 * Origin prepended to internal links. `''` on the main host (relative paths as
 * before); the ai.siglens.io layout sets the main site URL so the shared header's
 * `/market`, `/login`, search results etc. leave the ai host instead of 404-ing there.
 */
export function useHrefBase(): string {
    return useContext(LocaleContext).hrefBase;
}
