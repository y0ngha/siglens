import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { Geist } from 'next/font/google';
import localFont from 'next/font/local';
import { ReactQueryProvider } from '@/app/providers';
import { VisitorPing } from '@/features/visitor-ping';
import { AI_SITE_URL } from '@/shared/config/aiHost';
import { LocaleProvider } from '@/shared/i18n/LocaleContext';
import { pickMessages } from '@/shared/i18n/loadMessages';
import { isLocale, LOCALE_HREFLANG } from '@/shared/i18n/locales';
import { ThemeInitScript } from '@/shared/ui/ThemeInitScript';
import { AI_CLIENT_PATHS } from './aiClientPaths';
import '../../globals.css';

export const dynamic = 'force-dynamic';
const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const pretendard = localFont({
    src: '../../fonts/PretendardVariable-subset.woff2',
    variable: '--font-pretendard',
    display: 'swap',
    weight: '100 900',
});

export const metadata: Metadata = {
    metadataBase: new URL(AI_SITE_URL),
    title: { default: 'SiglensAI', template: '%s | SiglensAI' },
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
            className={`${geistSans.variable} ${pretendard.variable} h-full antialiased scheme-dark`}
        >
            <body className="flex min-h-full flex-col bg-secondary-900">
                <ThemeInitScript />
                <LocaleProvider locale={locale}>
                    <NextIntlClientProvider
                        locale={locale}
                        messages={pickMessages(messages, [...AI_CLIENT_PATHS])}
                    >
                        <ReactQueryProvider>
                            <VisitorPing />
                            {disabled ? (
                                <main className="mx-auto flex min-h-dvh w-full max-w-3xl items-center justify-center px-4 text-center text-secondary-200">
                                    {t('layout.9401e4')}
                                </main>
                            ) : (
                                children
                            )}
                        </ReactQueryProvider>
                    </NextIntlClientProvider>
                </LocaleProvider>
            </body>
        </html>
    );
}
