import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import Script from 'next/script';
import { cookies } from 'next/headers';
import { Geist, Geist_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { Header } from '@/components/layout/Header';
import type { HeaderUserMenuUser } from '@/components/layout/HeaderUserMenu';
import { SiteJsonLd } from '@/components/layout/SiteJsonLd';
import { PwaBanner } from '@/components/pwa/PwaBanner';
import { ReactQueryProvider } from '@/components/providers/ReactQueryProvider';
import { getCurrentUser } from '@/infrastructure/auth/getCurrentUser';
import { AUTH_HINT_COOKIE_NAME } from '@/lib/auth/cookieNames';
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

// TODO(seo): Geist는 라틴만 지원해 한글은 OS fallback에 의존 — CLS/디자인 일관성을 위해
//            Pretendard 같은 한글 웹폰트 도입을 검토. (FOIT vs FOUT, 번들 영향 별도 평가 필요)
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

/**
 * 두 단계 Suspense로 header flash를 원천 제거한다.
 *
 * 1단계(HeaderWithHint): hint 쿠키만 읽는다 — I/O 없음, 거의 즉시 완료.
 *    → 쿠키 있음: 내부 fallback을 skeleton으로 설정 (로그인 상태 힌트)
 *    → 쿠키 없음: 내부 fallback을 로그인/회원가입으로 설정 (이미 정답, flash 없음)
 *
 * 2단계(HeaderWithUser): DB 세션 조회 — blocking 작업이므로 Suspense 안에 격리.
 *    → 완료 후 실제 auth 상태로 교체.
 *
 * 외부 Suspense(skeleton)는 hint 쿠키 읽기가 완료될 때까지만 표시되며
 * cookies()는 메모리 조회라 실질적으로 비가시 구간이다.
 */
async function HeaderWithHint() {
    const cookieStore = await cookies();
    const hasSession = !!cookieStore.get(AUTH_HINT_COOKIE_NAME)?.value;
    return (
        <Suspense
            fallback={
                <Header currentUser={null} loadingUserMenu={hasSession} />
            }
        >
            <HeaderWithUser />
        </Suspense>
    );
}

async function HeaderWithUser() {
    const authUser = await getCurrentUser();
    const currentUser: HeaderUserMenuUser | null = authUser
        ? {
              email: authUser.email,
              name: authUser.name,
              tier: authUser.tier,
              avatarUrl: authUser.avatarUrl,
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
                    <Suspense
                        fallback={<Header currentUser={null} loadingUserMenu />}
                    >
                        <HeaderWithHint />
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
                <Analytics />
            </body>
        </html>
    );
}
