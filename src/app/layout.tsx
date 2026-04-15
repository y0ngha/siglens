import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import Script from 'next/script';
import { Geist, Geist_Mono } from 'next/font/google';
import { ReactQueryProvider } from '@/components/providers/ReactQueryProvider';
import { ADSENSE_PUBLISHER_ID, ADSENSE_ENABLED } from '@/lib/adsense';
import {
    ROOT_KEYWORDS,
    ROOT_TITLE,
    SITE_DESCRIPTION,
    SITE_NAME,
    SITE_URL,
} from '@/lib/seo';
import './globals.css';

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
});

export const metadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: {
        default: ROOT_TITLE,
        template: `%s | ${SITE_NAME}`,
    },
    description: SITE_DESCRIPTION,
    keywords: ROOT_KEYWORDS,
    applicationName: SITE_NAME,
    authors: [{ name: SITE_NAME, url: SITE_URL }],
    creator: SITE_NAME,
    openGraph: {
        type: 'website',
        siteName: SITE_NAME,
        title: ROOT_TITLE,
        description: SITE_DESCRIPTION,
        url: SITE_URL,
        locale: 'ko_KR',
    },
    twitter: {
        card: 'summary_large_image',
        title: ROOT_TITLE,
        description: SITE_DESCRIPTION,
    },
    icons: {
        apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
        },
    },
    alternates: {
        canonical: SITE_URL,
    },
    verification: {
        other: {
            'naver-site-verification':
                '14d27c128365a7edc27cb6fb330aeea2c9760fa2',
        },
    },
};

export const viewport: Viewport = {
    themeColor: '#0f172a',
    viewportFit: 'cover',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            lang="ko"
            className={`${geistSans.variable} ${geistMono.variable} h-full antialiased [color-scheme:dark]`}
        >
            <head>
                {ADSENSE_ENABLED && ADSENSE_PUBLISHER_ID && (
                    <Script
                        async
                        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUBLISHER_ID}`}
                        crossOrigin="anonymous"
                        strategy="afterInteractive"
                    />
                )}
            </head>
            <body className="flex min-h-full flex-col">
                <Suspense>
                    <ReactQueryProvider>{children}</ReactQueryProvider>
                </Suspense>
            </body>
        </html>
    );
}
