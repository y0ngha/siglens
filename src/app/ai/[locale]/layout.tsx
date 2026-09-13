import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { AuthSessionHeaderClient } from '@/app/_components/AuthSessionHeaderClient';
import { ReactQueryProvider } from '@/app/providers';
import { SearchOverlayProvider } from '@/features/ticker-search';
import { VisitorPing } from '@/features/visitor-ping';
import { AI_SITE_URL } from '@/shared/config/aiHost';
import { LocaleProvider } from '@/shared/i18n/LocaleContext';
import { pickMessages } from '@/shared/i18n/loadMessages';
import { isLocale, LOCALE_HREFLANG } from '@/shared/i18n/locales';
import Script from 'next/script';
import { SITE_URL } from '@/shared/lib/seo';
import { THEME_INIT_SCRIPT } from '@/shared/lib/theme';
import { AI_CLIENT_PATHS } from './aiClientPaths';
import { FONT_VARIABLE_CLASSES } from '../../fontVariables';
import '../../globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    metadataBase: new URL(AI_SITE_URL),
    title: { default: 'SIGLENS AI', template: '%s | SIGLENS AI' },
    // Default for everything under the ai host (conversations, not-found):
    // private or empty, never indexed. The landing (`page.tsx`) overrides it.
    robots: { index: false, follow: false },
};

export default async function AiRootLayout({
    children,
    params,
}: {
    readonly children: ReactNode;
    readonly params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    if (!isLocale(locale)) notFound();
    setRequestLocale(locale);
    const t = await getTranslations('app.ai');
    const messages = await getMessages({ locale });
    const disabled = process.env.AGENT_CHAT_DISABLED === '1';
    return (
        <html
            lang={LOCALE_HREFLANG[locale]}
            className={`${FONT_VARIABLE_CLASSES} h-full antialiased scheme-dark`}
            // `THEME_INIT_SCRIPT`는 첫 페인트 전에 `<html>`에 `data-theme`·`color-scheme`을
            // 찍는다. 서버 HTML에는 그 속성이 없으므로 React가 불일치로 보고 경고한다 —
            // 의도된 차이라 이 요소에서만 억제한다(자식 트리에는 영향 없음).
            suppressHydrationWarning
        >
            <body className="flex min-h-full flex-col bg-secondary-900">
                {/* 컴포넌트 트리에서 `<script>`를 렌더하면 클라이언트 내비게이션 때
                    실행되지 않고 React가 경고한다. `next/script`의 beforeInteractive는
                    루트 레이아웃에서만 허용되고(이 파일이 ai 서브트리의 루트),
                    하이드레이션 전에 실행돼 테마 깜빡임도 막는다. */}
                <Script
                    id="ai-theme-init"
                    strategy="beforeInteractive"
                    dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
                />
                <LocaleProvider locale={locale} hrefBase={SITE_URL}>
                    <NextIntlClientProvider
                        locale={locale}
                        messages={pickMessages(messages, [...AI_CLIENT_PATHS])}
                    >
                        <ReactQueryProvider>
                            <SearchOverlayProvider>
                                <VisitorPing />
                                <AuthSessionHeaderClient authReturn="ai" />
                                {disabled ? (
                                    <main className="mx-auto flex min-h-dvh w-full max-w-3xl items-center justify-center px-4 text-center text-secondary-200">
                                        {t('layout.9401e4')}
                                    </main>
                                ) : (
                                    children
                                )}
                            </SearchOverlayProvider>
                        </ReactQueryProvider>
                    </NextIntlClientProvider>
                </LocaleProvider>
            </body>
        </html>
    );
}
