import type { ReactNode } from 'react';
import { RouteMessages } from './RouteMessages';
import { resolveLocale } from './locales';

interface RouteLayoutProps {
    readonly children: ReactNode;
    readonly params: Promise<{ locale: string }>;
}

/**
 * 라우트 세그먼트 레이아웃 팩토리.
 *
 * 각 라우트는 `export default routeLayout('market')` 한 줄이면 된다.
 *
 * ## 왜 라우트마다 레이아웃이 필요한가
 *
 * 루트 프로바이더 하나에 전 라우트 키의 합집합을 실으면 `/login`·`/terms` 같은
 * 가벼운 페이지가 `widgets.options`·`views.symbol`·`widgets.chat`을 통째로 들고
 * 다닌다. 모든 라우트가 같은 번역 페이로드를 first-load JS와 RSC prefetch에
 * 실어 나르게 되므로, 라우트가 쓰는 키만 싣는다.
 *
 * ## 왜 페이지가 아니라 레이아웃인가
 *
 * 페이지의 기본 export를 감싸면 반환 트리가 한 겹 깊어져 페이지 구조를 검사하는
 * 테스트 191개가 깨진다. 레이아웃은 `{children}` 바깥이라 페이지 트리를 건드리지
 * 않는다. 경계 파일(`error.tsx`·`loading.tsx`)도 이 프로바이더 아래에서 렌더되므로
 * 추출기가 그것들의 키를 이 라우트 엔트리에 함께 넣는다.
 *
 * `route` 문자열은 `messages/_meta/clientKeys.json`의 키와 일치해야 한다 —
 * 어긋나면 크롬으로 폴백하고, 그 누락은 `clientKeyCoverage` 테스트가 잡는다.
 */
export function routeLayout(route: string) {
    return async function RouteLayout({ children, params }: RouteLayoutProps) {
        const { locale } = await params;
        return (
            <RouteMessages route={route} locale={resolveLocale(locale)}>
                {children}
            </RouteMessages>
        );
    };
}
