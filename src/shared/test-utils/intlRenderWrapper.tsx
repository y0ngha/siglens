import { NextIntlClientProvider } from 'next-intl';
import { LocaleProvider } from '@/shared/i18n/LocaleContext';
import { DEFAULT_LOCALE } from '@/shared/i18n/locales';
import enMessages from '@/../messages/en.json';
import jaMessages from '@/../messages/ja.json';
import zhMessages from '@/../messages/zh.json';
import koMessages from '../../../messages/ko.json';
import type { ComponentType, ReactNode } from 'react';

/**
 * 테스트에서 컴포넌트 트리를 감쌀 기본 i18n 프로바이더.
 *
 * **실제 프로바이더에 실제 ko 카탈로그**를 넣는다 — `useTranslations`를 mock하지
 * 않는다. 그래야 (1) 기존 테스트가 한국어 문자열을 그대로 단언해도 통과하고
 * (2) 카탈로그에서 키가 빠지면 `MISSING_MESSAGE` 폴백 문자열이 나와 테스트가
 * 실제로 실패한다. mock으로 대체하면 그 누락이 조용히 통과한다.
 */
export function IntlTestProvider({ children }: { children: ReactNode }) {
    return (
        <LocaleProvider locale={DEFAULT_LOCALE}>
            <NextIntlClientProvider
                locale={DEFAULT_LOCALE}
                messages={koMessages}
                timeZone="Asia/Seoul"
            >
                {children}
            </NextIntlClientProvider>
        </LocaleProvider>
    );
}

const CATALOGS = {
    ko: koMessages,
    en: enMessages,
    ja: jaMessages,
    zh: zhMessages,
} as const;

/**
 * **로케일을 지정해** 렌더한다 — 로케일별 동작을 검증하는 테스트용.
 *
 * `vitest.setup.dom.ts`가 모든 `render`를 ko 프로바이더로 감싸므로, 여기서는
 * 그 **안쪽에** 대상 로케일 프로바이더를 한 겹 더 넣는다. 중첩 시 안쪽이
 * 이기므로 결과적으로 지정한 로케일이 적용된다.
 *
 * `render`를 여기서 부르지 않는다 — 이 모듈은 `vitest.setup.dom.ts`가
 * `@testing-library/react` mock 안에서 import하므로, 여기서 그걸 import하면
 * 순환이 생겨 테스트 러너가 멈춘다. 요소만 감싸서 돌려주고 호출부가 렌더한다:
 * `render(withLocale(<X />, 'en'))`.
 */
export function withLocale(
    ui: ReactNode,
    locale: keyof typeof CATALOGS
): ReactNode {
    return (
        <LocaleProvider locale={locale}>
            <NextIntlClientProvider
                locale={locale}
                messages={CATALOGS[locale]}
                timeZone="Asia/Seoul"
            >
                {ui}
            </NextIntlClientProvider>
        </LocaleProvider>
    );
}

/**
 * 호출자가 넘긴 wrapper와 i18n 프로바이더를 합성한다.
 *
 * 호출자 wrapper(QueryClientProvider 등)를 그냥 덮어쓰면 그쪽 테스트가 깨지고,
 * 반대로 호출자 wrapper가 이기면 i18n이 빠진다. **둘 다** 살린다.
 */
export function composeWithIntl(
    Wrapper?: ComponentType<{ children: ReactNode }>
): ComponentType<{ children: ReactNode }> {
    if (!Wrapper) return IntlTestProvider;
    return function ComposedWrapper({ children }: { children: ReactNode }) {
        return (
            <IntlTestProvider>
                <Wrapper>{children}</Wrapper>
            </IntlTestProvider>
        );
    };
}
