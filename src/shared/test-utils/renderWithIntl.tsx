import {
    render,
    type RenderOptions,
    type RenderResult,
} from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement, ReactNode } from 'react';
import koMessages from '../../../messages/ko.json';
import { DEFAULT_LOCALE, type Locale } from '@/shared/i18n/locales';

interface RenderWithIntlOptions extends Omit<RenderOptions, 'wrapper'> {
    readonly locale?: Locale;
    /** 카탈로그를 덮어쓸 부분 메시지. 특정 키만 바꿔 검증할 때 쓴다. */
    readonly messages?: Record<string, unknown>;
}

/**
 * `useTranslations`를 쓰는 컴포넌트를 렌더한다.
 *
 * **기본 메시지는 실제 ko 카탈로그**다 — mock 문자열을 쓰면 키가 카탈로그에서
 * 빠졌을 때 테스트가 통과해 버린다(누락은 런타임에 키 문자열로 노출된다).
 * 실물을 넣으면 그 누락이 테스트에서 바로 드러난다.
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
            <NextIntlClientProvider
                locale={locale}
                messages={{ ...koMessages, ...messages }}
                timeZone="Asia/Seoul"
            >
                {children}
            </NextIntlClientProvider>
        );
    }
    return render(ui, { wrapper: Wrapper, ...options });
}
