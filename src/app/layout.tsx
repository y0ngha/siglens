import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ReactQueryProvider } from '@/components/providers/ReactQueryProvider';
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
    title: 'Siglens',
    description: '주식 종목 분석 및 차트 뷰어',
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
