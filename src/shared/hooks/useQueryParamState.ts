'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

interface UseQueryParamStateOptions {
    replace?: boolean;
}

type UseQueryParamStateResult = [string, (next: string) => void];

// 값이 defaultValue일 때는 URL에서 파라미터를 제거하여 canonical URL을 유지한다.
export function useQueryParamState(
    key: string,
    defaultValue: string,
    { replace = false }: UseQueryParamStateOptions = {}
): UseQueryParamStateResult {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const value = searchParams.get(key) ?? defaultValue;

    const setValue = useCallback(
        (next: string) => {
            const params = new URLSearchParams(searchParams.toString());
            if (next === defaultValue) params.delete(key);
            else params.set(key, next);
            const qs = params.toString();
            const url = qs === '' ? pathname : `${pathname}?${qs}`;
            if (replace) router.replace(url, { scroll: false });
            else router.push(url, { scroll: false });
        },
        [router, pathname, searchParams, key, defaultValue, replace]
    );

    return [value, setValue];
}
