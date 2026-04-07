import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ReactQueryProvider } from '@/components/providers/ReactQueryProvider';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/seo';
import './globals.css';

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
});

const ROOT_TITLE = `${SITE_NAME} | AI 기술적 주가 분석`;

export const metadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: {
        default: ROOT_TITLE,
        template: `%s | ${SITE_NAME}`,
    },
    description: SITE_DESCRIPTION,
    applicationName: SITE_NAME,
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
    robots: {
        index: true,
        follow: true,
    },
};

export const viewport: Viewport = {
    themeColor: '#0f172a',
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
            <body className="flex min-h-full flex-col">
                <ReactQueryProvider>{children}</ReactQueryProvider>
            </body>
        </html>
    );
}
