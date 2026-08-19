'use client';

import { useCallback } from 'react';
import { useCurrentLocale } from './LocaleContext';
import { localePath, splitLocalePath } from './locales';

/**
 * 클라이언트에서 **절대 경로로 이동할 때** 로케일 접두사를 붙이는 훅.
 *
 * `router.push('/AAPL')`처럼 현재 경로와 무관한 절대 경로는 로케일을 잃는다 —
 * `/en/…`에서 종목을 검색하면 ko 페이지로 떨어진다. 반면
 * `router.replace(pathname + '?x=1')`처럼 **현재 경로를 재사용**하는 코드는 이미
 * 접두사를 갖고 있어 손댈 필요가 없다.
 */
export function useLocalePath(): (path: string) => string {
    const locale = useCurrentLocale();
    // 멱등하다 — 이미 접두사가 붙은 경로를 넣어도 `/en/en/…`이 되지 않는다.
    return useCallback(
        path => localePath(locale, splitLocalePath(path).path),
        [locale]
    );
}
