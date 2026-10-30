'use client';

import { useTransition } from 'react';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/shared/i18n/navigation';
import { resolveLocale, type Locale } from '@/shared/i18n/locales';

interface UseLocaleSwitchResult {
    readonly locale: Locale;
    readonly isPending: boolean;
    /** 같은 페이지를 `next` 로케일로 연다. 현재 로케일이면 아무 일도 하지 않는다. */
    readonly select: (next: Locale) => void;
}

/**
 * 현재 로케일과, 같은 페이지를 다른 로케일로 여는 `select`.
 *
 * 전환은 `replace`다 — `push`면 언어를 두 번 바꾼 사용자가 뒤로가기를 눌렀을 때
 * 이전 언어 페이지로 돌아가 뒤로가기가 언어를 되돌리는 혼란이 생긴다.
 *
 * **쿼리스트링·해시를 보존한다.** next-intl의 `usePathname()`은 경로만 돌려주므로
 * 그대로 넘기면 검색 파라미터가 사라진다. 이는 편의가 아니라 데이터 손실이다 —
 * `/reset-password?token=…`에서 토큰이 날아가고, `/signup/oauth/consent?token=…`에서는
 * 진행 중이던 소셜 가입이 취소된다. `useSearchParams()`는 쓰지 않는다: 헤더는 Suspense
 * 경계 밖이라 그 훅의 CSR bailout이 정적 생성을 깬다. 필요한 건 반응성이 아니라 클릭
 * 시점의 값 하나뿐이다.
 *
 * 쿠키로 로케일을 기억하지 않는다. 로케일의 단일 소스는 URL이다.
 */
export function useLocaleSwitch(): UseLocaleSwitchResult {
    // `useLocale()`은 `string`이다 — 지원 목록으로 좁혀 단언 없이 `Locale`을 얻는다.
    const locale = resolveLocale(useLocale());
    const pathname = usePathname();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const select = (next: Locale) => {
        if (next === locale) return;
        const { search: query, hash } = window.location;
        startTransition(() => {
            router.replace(`${pathname}${query}${hash}`, { locale: next });
        });
    };

    return { locale, isPending, select };
}
