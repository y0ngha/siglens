import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import Script from 'next/script';
import { Geist, Geist_Mono } from 'next/font/google';
import { Header } from '@/components/layout/Header';
import type { HeaderUserMenuUser } from '@/components/layout/HeaderUserMenu';
import { SiteJsonLd } from '@/components/layout/SiteJsonLd';
import { PwaBanner } from '@/components/pwa/PwaBanner';
import { ReactQueryProvider } from '@/components/providers/ReactQueryProvider';
import { getCurrentUser } from '@/infrastructure/auth/getCurrentUser';
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
        images: [
            {
                url: '/og-image.png',
                width: OG_IMAGE_WIDTH,
                height: OG_IMAGE_HEIGHT,
                alt: SITE_NAME,
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

/**
 * DB 세션 조회를 Suspense 경계 안으로 격리해 navigation blocking을 방지한다.
 * fallback은 HeaderUserMenuFallback(클라이언트 컴포넌트)이 담당한다:
 *   JS 하이드레이션 직후 document.cookie의 siglens_auth 힌트 쿠키를 읽어
 *   비로그인 사용자에게는 즉시 로그인/회원가입 버튼을 표시하고,
 *   로그인 사용자에게는 스켈레톤을 유지하다가 실제 프로필로 교체한다.
 */
async function HeaderWithUser() {
    const authUser = await getCurrentUser();
    const currentUser: HeaderUserMenuUser | null = authUser
        ? {
              email: authUser.email,
              name: authUser.name,
              tier: authUser.tier,
          }
        : null;
    return <Header currentUser={currentUser} />;
}

export default function RootLayout({ children }: RootLayoutProps) {
    return (
        <html
            lang="ko"
            className={`${geistSans.variable} ${geistMono.variable} h-full antialiased scheme-dark`}
        >
            <body className="flex min-h-full flex-col">
                <SiteJsonLd />
                <ReactQueryProvider>
                    <PwaBanner />
                    <Suspense fallback={<Header currentUser={null} fallback />}>
                        <HeaderWithUser />
                    </Suspense>
                    {children}
                </ReactQueryProvider>
                {ADSENSE_ENABLED && (
                    <Script
                        async
                        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"
                        crossOrigin="anonymous"
                        strategy="lazyOnload"
                    />
                )}
            </body>
        </html>
    );
}
