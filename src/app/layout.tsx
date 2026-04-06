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
    title: 'Siglens | AI 기술적 주가 분석',
    description:
        '미국 주식 AI 기술적 분석 플랫폼 — 인디케이터, 패턴, 스킬 기반 종합 분석',
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
