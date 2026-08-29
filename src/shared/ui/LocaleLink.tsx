'use client';

import NextLink from 'next/link';
import type { ComponentProps } from 'react';
import { useCurrentLocale } from '@/shared/i18n/LocaleContext';
import { localePath, splitLocalePath } from '@/shared/i18n/locales';

type NextLinkProps = ComponentProps<typeof NextLink>;

/**
 * 내부 링크의 **유일한** 진입점. 앱 코드는 `next/link`를 직접 import하지 않는다.
 *
 * **왜 필요한가**: `localePrefix: 'as-needed'`에서 접두사 없는 경로는 곧 기본
 * 로케일이다. `/en/AAPL`에서 `<Link href="/market">`을 누르면 그대로 `/market`으로
 * 가고 프록시는 그것을 ko로 해석한다 — **내비 클릭 한 번에 사용자가 고른 언어가
 * 사라진다.** 헤더·푸터·크로스링크·탭·히어로 퀵링크가 전부 같은 경로다.
 *
 * 로케일은 `useCurrentLocale()`(기본값 있는 컨텍스트)에서 얻는다 — 이유는
 * `LocaleContext`의 JSDoc 참고. `'use client'`지만 서버 부모가 넘긴 `children`은
 * prop이라 서버 렌더 결과가 그대로 유지된다(`next/link` 자체가 이미 클라이언트
 * 컴포넌트라 경계도 새로 생기지 않는다).
 *
 * 외부 URL(`https://…`), 앵커(`#…`), 객체 href는 그대로 통과시킨다.
 */
export function LocaleLink({ href, ...rest }: NextLinkProps) {
    const locale = useCurrentLocale();
    const localized =
        typeof href === 'string' && href.startsWith('/')
            ? localePath(locale, splitLocalePath(href).path)
            : href;
    return <NextLink href={localized} {...rest} />;
}
