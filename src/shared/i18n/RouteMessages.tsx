import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { routeClientPaths } from './clientNamespaces';
import { loadMessages, pickMessages } from './loadMessages';
import type { Locale } from './locales';

interface RouteMessagesProps {
    /**
     * `src/app/[locale]/` 기준 라우트 경로. 홈은 `'.'`.
     * `messages/_meta/clientKeys.json`의 키와 일치해야 한다.
     */
    readonly route: string;
    readonly locale: Locale;
    readonly children: ReactNode;
}

/**
 * 페이지 서브트리에 **그 라우트가 실제로 쓰는 메시지만** 내려보낸다.
 *
 * 루트 레이아웃은 크롬(헤더·푸터·전역 모달)만 싣고, 나머지는 각 페이지가
 * 자기 몫만 싣는다. 크롬은 `{children}` 바깥에서 렌더되므로 루트 프로바이더를
 * 그대로 쓴다 — 이 프로바이더는 페이지 서브트리에만 적용된다.
 *
 * 서버 컴포넌트는 이 프로바이더와 무관하다. `request.ts`가 요청 설정에서
 * 카탈로그 전체를 주므로 서버 렌더는 항상 모든 키를 본다.
 *
 * ⚠️ **`getMessages()`를 쓰지 않는다.** 그건 요청 설정을 경유하면서
 * `requestLocale`(= `headers()`)에 닿아 페이지를 동적으로 만든다 — 실측으로
 * `/ko/account` 프리렌더가 `useSearchParams() should be wrapped in a suspense
 * boundary`로 깨졌고, 통과했더라도 전 라우트의 ISR을 잃었을 것이다.
 * `loadMessages(locale)`는 카탈로그를 직접 import하는 순수 함수다.
 */
export async function RouteMessages({
    route,
    locale,
    children,
}: RouteMessagesProps) {
    const messages = await loadMessages(locale);
    return (
        <NextIntlClientProvider
            locale={locale}
            messages={pickMessages(messages, routeClientPaths(route))}
        >
            {children}
        </NextIntlClientProvider>
    );
}
