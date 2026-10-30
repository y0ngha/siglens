import {
    render,
    type RenderOptions,
    type RenderResult,
} from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement, ReactNode } from 'react';
import { LocaleProvider } from '@/shared/i18n/LocaleContext';
import { DEFAULT_LOCALE, type Locale } from '@/shared/i18n/locales';
import { MESSAGE_CATALOGS } from './messageCatalogs';

interface RenderWithIntlOptions extends Omit<RenderOptions, 'wrapper'> {
    readonly locale?: Locale;
    /** 카탈로그를 덮어쓸 부분 메시지. 특정 키만 바꿔 검증할 때 쓴다. */
    readonly messages?: Record<string, unknown>;
}

/**
 * `useTranslations`를 쓰는 컴포넌트를 렌더한다.
 *
 * **해당 로케일의 실제 카탈로그**를 넣는다 — mock 문자열을 쓰면 키가 카탈로그에서
 * 빠졌을 때 테스트가 통과해 버린다. `LocaleProvider`도 함께 감싸므로
 * `useCurrentLocale()`(링크 접두사)까지 그 로케일로 동작한다. `locale`을 받고도
 * ko 카탈로그를 넣으면 영어를 검증하는 것처럼 보이면서 한국어를 단언하게 된다.
 */
export function renderWithIntl(
    ui: ReactElement,
    {
        locale = DEFAULT_LOCALE,
        messages,
        ...options
    }: RenderWithIntlOptions = {}
): RenderResult {
    function Wrapper({ children }: { children: ReactNode }) {
        return (
            <LocaleProvider locale={locale}>
                <NextIntlClientProvider
                    locale={locale}
                    messages={{ ...MESSAGE_CATALOGS[locale], ...messages }}
                    timeZone="Asia/Seoul"
                >
                    {children}
                </NextIntlClientProvider>
            </LocaleProvider>
        );
    }
    return render(ui, { wrapper: Wrapper, ...options });
}
