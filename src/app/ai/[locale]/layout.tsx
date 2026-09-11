import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { isLocale, LOCALE_HREFLANG } from '@/shared/i18n/locales';
import '../../globals.css';

export const dynamic = 'force-dynamic';

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
    return (
        <html
            lang={LOCALE_HREFLANG[locale]}
            className="h-full antialiased scheme-dark"
        >
            <body className="flex min-h-full flex-col">{children}</body>
        </html>
    );
}
