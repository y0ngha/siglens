import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import Script from 'next/script';
import { Geist, Geist_Mono } from 'next/font/google';
import localFont from 'next/font/local';
import { AuthSessionHeaderClient } from '@/app/_components/AuthSessionHeaderClient';
import { Footer } from '@/widgets/layout/Footer';
import { SiteJsonLd } from '@/widgets/layout/SiteJsonLd';
import { PwaBanner } from '@/features/pwa-install';
import { NoticePopupLoader } from '@/widgets/notice-popup';
import { ReactQueryProvider } from '@/app/providers';
import { ADSENSE_ENABLED } from '@/shared/lib/adsense';
import { CF_BEACON_TOKEN } from '@/shared/lib/cloudflareAnalytics';
import {
    ROOT_FULL_TITLE,
    ROOT_HEADLINE,
    ROOT_KEYWORDS,
    ROOT_TITLE,
    SITE_DESCRIPTION,
    SITE_NAME,
    SITE_URL,
} from '@/shared/lib/seo';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
import {
    DEFAULT_LOCALE,
    isLocale,
    LOCALES,
    LOCALE_OG,
    localePath,
    resolvePrerenderLocales,
    type Locale,
} from '@/shared/i18n/locales';
import { pickMessages } from '@/shared/i18n/loadMessages';
import { LocaleProvider } from '@/shared/i18n/LocaleContext';
import { ROOT_CLIENT_NAMESPACES } from '@/shared/i18n/clientNamespaces';
import '../globals.css';

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
    src: '../fonts/PretendardVariable-subset.woff2',
    variable: '--font-pretendard',
    display: 'swap',
    weight: '100 900',
});

/**
 * 빌드 시점에 **프리렌더할** 로케일.
 *
 * ⚠️ 이 함수가 없으면 `[locale]`이 dynamic 세그먼트로 남아 **전 라우트의 ISR이
 * 꺼진다**. 이 레포에서 가장 비싼 실수다.
 *
 * ⚠️ 그렇다고 4개를 전부 반환하면 안 된다. 정적 페이지가 빌드 중 외부 API를
 * 호출하는데(`/market`은 FMP 시세를 종목별로 가져온다) 로케일마다 같은 호출을
 * 반복해 **FMP가 429로 끊고 빌드가 통째로 실패한다** — 실측으로 확인했다
 * (`Failed to build /[locale]/market/page: /en/market after 3 attempts`).
 *
 * 그래서 기본은 ko만 프리렌더한다. `dynamicParams`는 기본값 `true`라 나머지
 * 로케일은 **첫 요청에 on-demand ISR로 생성**되고 그 뒤로는 동일하게 캐시된다.
 * SEO에도 영향이 없다(크롤러의 첫 방문이 곧 생성 트리거다).
 * 프리렌더 로케일을 늘리려면 `PRERENDER_LOCALES=ko,en`처럼 명시한다 —
 * 빌드 시간과 외부 API 호출량이 로케일 수에 비례해 늘어난다.
 */
export function generateStaticParams(): Array<{ locale: Locale }> {
    return resolvePrerenderLocales(process.env.PRERENDER_LOCALES).map(
        locale => ({ locale })
    );
}

interface LocaleParams {
    readonly params: Promise<{ locale: string }>;
}

export async function generateMetadata({
    params,
}: LocaleParams): Promise<Metadata> {
    const { locale: raw } = await params;
    const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
    const siteUrl = `${SITE_URL}${localePath(locale, '/')}`.replace(/\/$/, '');

    return {
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
            title: ROOT_FULL_TITLE,
            description: SITE_DESCRIPTION,
            url: siteUrl,
            locale: LOCALE_OG[locale],
            alternateLocale: LOCALES.filter(l => l !== locale).map(
                l => LOCALE_OG[l]
            ),
            images: [
                {
                    url: '/og-image.png',
                    width: OG_IMAGE_WIDTH,
                    height: OG_IMAGE_HEIGHT,
                    alt: `${ROOT_HEADLINE} — 차트, 펀더멘털, 뉴스, 옵션, 공포 탐욕 지수, 종합 결론`,
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title: ROOT_FULL_TITLE,
            description: SITE_DESCRIPTION,
            images: ['/og-image.png'],
        },
        // apple-touch-icon은 file-based 규약(src/app/apple-icon.png)이 <link rel="apple-touch-icon">
        // 을 자동 생성하므로 metadata.icons로 중복 선언하지 않는다. 이전엔 둘이 공존해 동일
        // 이미지(184×180)가 두 번 링크됐고, 수동 선언의 sizes='180x180'도 실제와 불일치했다.
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
        // canonical은 root layout에서 설정하지 않는다.
        // 루트 레벨 canonical은 자기 자신의 URL을 가진 canonical을 선언하지 않는
        // 미래 페이지에서 SITE_URL이 상속되는 잠재적 footgun이 된다.
        // 각 인덱서블 페이지는 자체 alternates.canonical을 선언한다.
        // 홈 페이지의 canonical은 src/app/page.tsx에 명시한다.
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
}

export const viewport: Viewport = {
    themeColor: '#0f172a',
    viewportFit: 'cover',
};

interface RootLayoutProps {
    readonly children: ReactNode;
    readonly params: Promise<{ locale: string }>;
}

export default async function RootLayout({
    children,
    params,
}: RootLayoutProps) {
    const { locale } = await params;
    // `[locale]`은 알 수 없는 최상위 경로(`/unknown.txt`)까지 잡아채는 catch-all처럼
    // 동작한다. 검증하지 않으면 그런 요청이 200으로 렌더돼 soft 404가 된다 —
    // 이 사이트가 2026-07에 겪은 바로 그 사고 유형이다.
    if (!isLocale(locale)) notFound();
    // 정적 렌더 활성화. 이 호출이 없으면 next-intl이 헤더를 읽어 라우트가
    // dynamic으로 떨어지고 ISR이 통째로 꺼진다(Next 16.2는 next/root-params 미지원).
    setRequestLocale(locale);

    // 로케일을 명시적으로 넘긴다. 인자 없이 부르면 요청 스코프 상태에 의존하는데,
    // 이 레이아웃은 `params`로 이미 확정된 값을 갖고 있다 — 요청 상태를 거칠
    // 이유가 없고, `generateMetadata`가 먼저 도는 순서에도 영향받지 않는다.
    const messages = await getMessages({ locale });

    return (
        <html
            lang={locale}
            className={`${geistSans.variable} ${geistMono.variable} ${pretendard.variable} h-full overflow-x-hidden antialiased scheme-dark`}
        >
            {/* overflow-x-hidden on both html and body prevents fixed/transformed elements (mobile drawer)
                from extending the document scrollWidth past the viewport edge. */}
            <body className="flex min-h-full flex-col overflow-x-hidden">
                <SiteJsonLd />
                {/* 루트에 마운트되는 클라이언트 컴포넌트(헤더·푸터·배너·모달)가 쓰는
                    네임스페이스만 주입한다. 전체 카탈로그를 넘기면 first-load JS가
                    회귀한다 — 라우트별 추가 네임스페이스는 해당 페이지가 자체
                    프로바이더로 덧붙인다. */}
                {/* 링크·프로그래매틱 이동이 로케일을 유지하도록 트리 전체에
                    현재 로케일을 흘려보낸다(`LocaleLink`, `useLocalePath`). */}
                <LocaleProvider locale={locale}>
                    <NextIntlClientProvider
                        locale={locale}
                        messages={pickMessages(
                            messages,
                            ROOT_CLIENT_NAMESPACES
                        )}
                    >
                        <ReactQueryProvider>
                            <PwaBanner />
                            <NoticePopupLoader />
                            {/* 인증 헤더는 클라이언트에서 렌더된다(cookies()를 static render
                        트리에서 제거 → 전 라우트 ISR 가능). 상세는 AuthSessionHeaderClient JSDoc. */}
                            <AuthSessionHeaderClient />
                            {children}
                            {/* Footer를 root layout에 두는 이유: home/404/legal 페이지에만
                        footer가 있어 /market, /backtesting, /[symbol]/* 등 대부분 라우트
                        에 내부 링크가 누수됐다. 차트 페이지(/[symbol])는 SymbolLayout의
                        sticky-footer jail(`min-h-[calc(100dvh-3.5rem)]`)이 chart+AI를
                        첫 viewport에 가득 채우고, footer는 jail의 형제로 그 아래에
                        위치한다 — 사용자가 스크롤을 내리면 footer가 보인다. */}
                            <Footer />
                        </ReactQueryProvider>
                    </NextIntlClientProvider>
                </LocaleProvider>
                {ADSENSE_ENABLED && (
                    <Script
                        async
                        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"
                        crossOrigin="anonymous"
                        strategy="lazyOnload"
                    />
                )}
                {/* Cloudflare Web Analytics — 쿠키리스 트래픽 측정(UV/PV + 페이지별
                    조회수). beacon이 history API로 SPA 라우팅을 자동 추적하므로 추가
                    설정이 필요 없다. afterInteractive로 빠른 이탈 방문자까지 집계해
                    접속자 수 정확도를 확보한다(beacon ~5KB라 LCP/INP 영향은 미미). */}
                {CF_BEACON_TOKEN && (
                    <Script
                        src="https://static.cloudflareinsights.com/beacon.min.js"
                        data-cf-beacon={`{"token": "${CF_BEACON_TOKEN}"}`}
                        strategy="afterInteractive"
                    />
                )}
            </body>
        </html>
    );
}
