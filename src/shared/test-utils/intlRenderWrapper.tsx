import { NextIntlClientProvider } from 'next-intl';
import { LocaleProvider } from '@/shared/i18n/LocaleContext';
import { DEFAULT_LOCALE } from '@/shared/i18n/locales';
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
