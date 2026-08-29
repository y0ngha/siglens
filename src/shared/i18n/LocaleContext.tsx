'use client';

import { createContext, useContext, type ReactNode } from 'react';
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
const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({
    locale,
    children,
}: {
    readonly locale: Locale;
    readonly children: ReactNode;
}) {
    return (
        <LocaleContext.Provider value={locale}>
            {children}
        </LocaleContext.Provider>
    );
}

/** 현재 로케일. 프로바이더가 없으면 기본 로케일. */
export function useCurrentLocale(): Locale {
    return useContext(LocaleContext);
}
