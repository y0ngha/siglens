import {
    render,
    type RenderOptions,
    type RenderResult,
} from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement, ReactNode } from 'react';
import koMessages from '../../../messages/ko.json';
import enMessages from '../../../messages/en.json';
import jaMessages from '../../../messages/ja.json';
import zhMessages from '../../../messages/zh.json';
import { LocaleProvider } from '@/shared/i18n/LocaleContext';
import { DEFAULT_LOCALE, type Locale } from '@/shared/i18n/locales';

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
 * `useCurrentLocale()`(링크 접두사)까지 그 로케일로 동작한다.
 */
/**
 * 로케일별 실제 카탈로그.
 *
 * 예전에는 `locale`을 받고도 항상 ko 카탈로그를 넣었다. 그러면
 * `renderWithIntl(ui, { locale: 'en' })`이 영어를 검증하는 것처럼 보이면서
 * 실제로는 한국어를 단언한다 — 로케일 회귀를 잡으라고 만든 테스트가 구조적으로
 * 실명한다.
 */
const CATALOGS = {
    ko: koMessages,
    en: enMessages,
    ja: jaMessages,
    zh: zhMessages,
} as const;

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
                    messages={{ ...CATALOGS[locale], ...messages }}
                    timeZone="Asia/Seoul"
                >
                    {children}
                </NextIntlClientProvider>
            </LocaleProvider>
        );
    }
    return render(ui, { wrapper: Wrapper, ...options });
}
