import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import Script from 'next/script';
import { Geist, Geist_Mono } from 'next/font/google';
import localFont from 'next/font/local';
import { Analytics } from '@vercel/analytics/next';
import { AuthSessionHeader } from '@/app/_components/AuthSessionHeader';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { SiteJsonLd } from '@/components/layout/SiteJsonLd';
import { PwaBanner } from '@/components/pwa/PwaBanner';
import { ReactQueryProvider } from '@/components/providers/ReactQueryProvider';
import { ADSENSE_ENABLED } from '@/lib/adsense';
import {
    ROOT_KEYWORDS,
    ROOT_TITLE,
    SITE_DESCRIPTION,
    SITE_NAME,
    SITE_URL,
} from '@/lib/seo';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/lib/og';
import './globals.css';

// Geist는 라틴만 지원하므로 한글 글리프는 globals.css의 --font-sans 스택에서
// 자동으로 Pretendard Variable로 fallback된다. 한글 OS 폰트 의존을 끊어
// 디바이스 간 typography 일관성과 한글 CLS를 개선한다.
const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
});

// Pretendard Variable (subset) — self-host. next/font/local이 fingerprint URL
// + 1년 immutable Cache-Control을 자동 부여하고, fallback font(OS)와의 metric
// 을 자동 측정해 size-adjust로 CLS를 거의 0으로 만든다. third-party CDN 의존
// 없이도 dynamic-subset CDN 대비 안정성과 privacy가 우위.
//
// Subset 범위 (cmap에 포함된 실제 글리프 기준):
//  • Basic Latin / Latin-1 Supplement
//  • Hangul Compatibility Jamo (U+3130–U+318F)
//  • Hangul Syllables 중 KS X 1001 상용 음절 2,350자 (전체 U+AC00–U+D7A3가 아님)
//  • 일반 구두점 · 통화 · 위·아래 첨자 · 분수 · 수학 기호
//  • UI 글리프: 화살표(→ ↑ ↓ ←), 도형(▲ ▼ ▽ ○ ◈ ▾), ⚠, ✓ ✕ ✗, ⓘ 등 49자
// 폰트 파일은 src/app/fonts/에 colocate한다 (next/font/local 권장 패턴 — 단일
// 소비자인 layout.tsx 옆에 두어 dual-serving 가능성을 차단).
// 원본 2.0 MB → 467 KB (-77%). 모바일 Slow 4G에서 text LCP 차단 시간을 10초
// 이상 단축한다. unicode-range 분할은 운영 복잡도 증가 대비 효과가 크지 않아
// 단일 파일을 유지한다.
const pretendard = localFont({
    src: './fonts/PretendardVariable-subset.woff2',
    variable: '--font-pretendard',
    display: 'swap',
    weight: '100 900',
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
        images: [
            {
                url: '/og-image.png',
                width: OG_IMAGE_WIDTH,
                height: OG_IMAGE_HEIGHT,
                alt: '미국 주식 AI 분석 — 차트, 펀더멘털, 뉴스, 옵션, 공포 탐욕 지수, 종합 결론',
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: ROOT_TITLE,
        description: SITE_DESCRIPTION,
        images: ['/og-image.png'],
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
    // Google Search Console token: set NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION env var.
    verification: {
        other: {
            'naver-site-verification':
                '14d27c128365a7edc27cb6fb330aeea2c9760fa2',
        },
        ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
            ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
            : {}),
    },
};

export const viewport: Viewport = {
    themeColor: '#0f172a',
    viewportFit: 'cover',
};

interface RootLayoutProps {
    readonly children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
    return (
        <html
            lang="ko"
            className={`${geistSans.variable} ${geistMono.variable} ${pretendard.variable} h-full antialiased scheme-dark`}
        >
            <body className="flex min-h-full flex-col">
                <SiteJsonLd />
                <ReactQueryProvider>
                    <PwaBanner />
                    {/* cookies() 격리용 Suspense — 상세 동작은 AuthSessionHeader의 JSDoc 참조.
                        fallback은 동일한 Header shell + skeleton user menu라 DOM 구조가
                        일치해 CLS / hydration mismatch가 없다. */}
                    <Suspense
                        fallback={<Header currentUser={null} loadingUserMenu />}
                    >
                        <AuthSessionHeader />
                    </Suspense>
                    {children}
                    {/* Footer를 root layout에 두는 이유: home/404/legal 페이지에만
                        footer가 있어 /market, /backtesting, /[symbol]/* 등 대부분 라우트
                        에 내부 링크가 누수됐다. 차트 페이지(/[symbol])는 SymbolLayout의
                        sticky-footer jail(`min-h-[calc(100dvh-3.5rem)]`)이 chart+AI를
                        첫 viewport에 가득 채우고, footer는 jail의 형제로 그 아래에
                        위치한다 — 사용자가 스크롤을 내리면 footer가 보인다. */}
                    <Footer />
                </ReactQueryProvider>
                {ADSENSE_ENABLED && (
                    <Script
                        async
                        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"
                        crossOrigin="anonymous"
                        strategy="lazyOnload"
                    />
                )}
                <Analytics />
            </body>
        </html>
    );
}
