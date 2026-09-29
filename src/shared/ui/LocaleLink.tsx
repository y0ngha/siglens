'use client';

import NextLink from 'next/link';
import type { ComponentProps } from 'react';
import { useCurrentLocale, useHrefBase } from '@/shared/i18n/LocaleContext';
import { localePath, splitLocalePath } from '@/shared/i18n/locales';
import { useNavigationPending } from '@/shared/model/NavigationPendingContext';

type NextLinkProps = ComponentProps<typeof NextLink>;
type OnNavigate = NonNullable<NextLinkProps['onNavigate']>;

/**
 * 호출부의 `onNavigate`가 `preventDefault`를 불렀는지 여부를 돌려준다.
 * 원본 `event`는 그대로 넘기되, `preventDefault` 호출만 가로채 기록한다 —
 * `let` 변수 대신 배열 길이로 "불렸는가"를 나타내 불변 선언을 유지한다.
 */
function callerCancelled(
    handler: OnNavigate | undefined,
    event: Parameters<OnNavigate>[0]
): boolean {
    const calls: true[] = [];
    handler?.({
        preventDefault: () => {
            calls.push(true);
            event.preventDefault();
        },
    });
    return calls.length > 0;
}

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
 *
 * ai.siglens.io처럼 `hrefBase`(`useHrefBase()`)가 설정된 호스트에서는 로케일 경로
 * 앞에 그 origin을 붙여 절대 URL로 만든다 — 절대 cross-origin href는 `next/link`가
 * 클라이언트 라우팅 대신 전체 네비게이션을 하게 만드는데, 그게 의도한 동작이다
 * (다른 호스트의 라우트 트리로는 애초에 클라이언트 라우팅을 할 수 없다).
 */
export function LocaleLink({ href, onNavigate, ...rest }: NextLinkProps) {
    const locale = useCurrentLocale();
    const base = useHrefBase();
    const { startNavigation } = useNavigationPending();
    const localized =
        typeof href === 'string' && href.startsWith('/')
            ? `${base}${localePath(locale, splitLocalePath(href).path)}`
            : href;
    return (
        <NextLink
            href={localized}
            // `onNavigate`는 같은 앱 안의 클라이언트 내비게이션에서만 불린다(수정키
            // 클릭·새 탭·cross-origin 제외). 클릭 순간을 전역에 알려 목적지 골격을
            // RSC 도착 전에 그리게 한다 — `NavigationPendingContext` JSDoc 참고.
            onNavigate={event => {
                // 호출부가 이동을 취소하면(preventDefault) 골격을 세우지 않는다.
                if (
                    !callerCancelled(onNavigate, event) &&
                    typeof localized === 'string'
                ) {
                    startNavigation(localized);
                }
            }}
            {...rest}
        />
    );
}
