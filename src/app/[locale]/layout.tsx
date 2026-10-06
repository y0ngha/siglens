import type { Metadata, Viewport } from 'next';
import { localePageRobots, localeOpenGraph } from '@/shared/lib/seoAlternates';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import {
    getMessages,
    setRequestLocale,
    getTranslations,
} from 'next-intl/server';
import Script from 'next/script';
import { SITE_VIEWPORT } from '@/shared/config/viewport';
import { FONT_VARIABLE_CLASSES } from '../fontVariables';
import { AuthSessionHeaderClient } from '@/app/_components/AuthSessionHeaderClient';
import { Footer } from '@/widgets/layout/Footer';
import { SiteJsonLd } from '@/widgets/layout/SiteJsonLd';
import { PwaBanner } from '@/features/pwa-install/ui/PwaBanner';
import { AnalysisRateLimitModalHost } from '@/features/analysis-rate-limit/ui/AnalysisRateLimitModalHost';
import { VisitorPing } from '@/features/visitor-ping/ui/VisitorPing';
import { NoticePopupLoader } from '@/widgets/notice-popup/ui/NoticePopupLoader';
import { ReactQueryProvider } from '@/app/providers';
import { SearchOverlayProvider } from '@/features/ticker-search/model/SearchOverlayContext';
import { NavigationPendingProvider } from '@/shared/model/NavigationPendingContext';
import { RoutePendingSlot } from '@/app/_components/RoutePendingSlot';
import { ADSENSE_ENABLED } from '@/shared/lib/adsense';
import { CF_BEACON_TOKEN } from '@/shared/lib/cloudflareAnalytics';
import { THEME_INIT_SCRIPT } from '@/shared/lib/theme';
import { GoogleAdsTag } from '@/app/_components/GoogleAdsTag';
import { GOOGLE_ADS_ID } from '@/shared/config/googleAds';
import {
    brandIntroName,
    ROOT_KEYWORDS,
    SITE_NAME,
    SITE_URL,
} from '@/shared/lib/seo';
import { buildTwitterMetadata } from '@/shared/lib/twitterMetadata';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
import {
    isLocale,
    LOCALE_HREFLANG,
    localePath,
    resolvePrerenderLocales,
    type Locale,
    resolveLocale,
} from '@/shared/i18n/locales';
import { pickMessages } from '@/shared/i18n/loadMessages';
import { LocaleProvider } from '@/shared/i18n/LocaleContext';
import { CHROME_CLIENT_PATHS } from '@/shared/i18n/clientNamespaces';
import '../globals.css';

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
    const locale = resolveLocale(raw);
    const siteUrl = `${SITE_URL}${localePath(locale, '/')}`.replace(/\/$/, '');
    // 루트 메타데이터도 카탈로그를 쓴다 — 예전에는 `ROOT_TITLE`·`SITE_DESCRIPTION`
    // 한국어 상수라 `/en`·`/ja`·`/zh`의 탭 제목과 공유 카드가 통째로 한국어였다.
    const tSeo = await getTranslations({ locale, namespace: 'shared.seo' });
    // 브랜드가 제목에 들어간다(2026-10-05 감사: 홈 제목에 브랜드가 없어 "시그렌즈"·"Siglens"
    // 검색이 홈으로 귀결되지 않았다). 한글 표기는 인자로 넘긴다 — 카탈로그에 직접 적으면
    // ko 문장만 길어져 번역 검증의 길이 게이트가 다른 로케일을 잘린 번역으로 본다.
    const rootTitle = tSeo('root.title', { v0: brandIntroName(locale) });

    return {
        metadataBase: new URL(SITE_URL),
        title: {
            default: rootTitle,
            template: `%s | ${SITE_NAME}`,
        },
        description: tSeo('root.description'),
        // 로케일별 매니페스트. 기본 `/manifest.webmanifest`를 그대로 두면 `/en`에서
        // 설치해도 홈 화면 이름·바로가기가 한국어로 굳는다.
        manifest: `${localePath(locale, '/manifest.webmanifest')}`,
        keywords: ROOT_KEYWORDS,
        applicationName: SITE_NAME,
        authors: [{ name: SITE_NAME, url: SITE_URL }],
        creator: SITE_NAME,
        openGraph: {
            type: 'website',
            siteName: SITE_NAME,
            title: rootTitle,
            description: tSeo('root.description'),
            url: siteUrl,
            // 색인 게이트를 존중하는 단일 출처를 쓴다. 여기 하드코딩을 남겨두면
            // 홈 페이지만 준비되지 않은 로케일 3개를 og 대체본으로 광고한다
            // (hreflang은 0개를 내보내는데 og만 3개 — 실측으로 잡혔다).
            ...localeOpenGraph(locale),
            images: [
                {
                    url: '/og-image.png',
                    width: OG_IMAGE_WIDTH,
                    height: OG_IMAGE_HEIGHT,
                    alt: tSeo('root.ogImageAlt', {
                        v0: tSeo('root.headline'),
                    }),
                },
            ],
        },
        twitter: buildTwitterMetadata({
            title: rootTitle,
            description: tSeo('root.description'),
            images: ['/og-image.png'],
        }),
        // apple-touch-icon은 file-based 규약(src/app/apple-icon.png)이 <link rel="apple-touch-icon">
        // 을 자동 생성하므로 metadata.icons로 중복 선언하지 않는다. 이전엔 둘이 공존해 동일
        // 이미지(184×180)가 두 번 링크됐고, 수동 선언의 sizes='180x180'도 실제와 불일치했다.
        // 색인 게이트를 통과 못 한 로케일은 noindex. `robots`를 직접 선언하는
        // 페이지는 이 값을 통째로 덮으므로 각자 같은 `localePageRobots`를 불러야
        // 미리보기 지시(`googleBot`)가 유지된다.
        robots: localePageRobots(locale),
        // canonical은 root layout에서 설정하지 않는다.
        // 루트 레벨 canonical은 자기 자신의 URL을 가진 canonical을 선언하지 않는
        // 미래 페이지에서 SITE_URL이 상속되는 잠재적 footgun이 된다.
        // 각 인덱서블 페이지는 자체 alternates.canonical을 선언한다.
        // 홈 페이지의 canonical은 src/app/[locale]/(home)/page.tsx에 명시한다.
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

// 값과 근거는 `SITE_VIEWPORT` — ai 호스트 루트 레이아웃과 같은 값을 쓴다.
export const viewport: Viewport = SITE_VIEWPORT;

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
            lang={LOCALE_HREFLANG[locale]}
            className={`${FONT_VARIABLE_CLASSES} h-full overflow-x-hidden antialiased scheme-dark`}
            // `THEME_INIT_SCRIPT`가 첫 페인트 전에 `<html>`에 `data-theme`과 인라인
            // `color-scheme`을 찍는다. 서버 HTML에는 둘 다 없으므로 React가 불일치로
            // 경고한다 — 의도된 차이라 이 요소에서만 억제한다(자식 트리에는 영향 없음).
            // `scheme-dark` 클래스는 스크립트가 못 도는 환경의 기본값으로 남는다 —
            // 인라인 style이 클래스보다 우선하므로 라이트 사용자에게서 둘이 다투지 않는다.
            suppressHydrationWarning
        >
            {/* overflow-x-hidden on both html and body prevents fixed/transformed elements (mobile drawer)
                from extending the document scrollWidth past the viewport edge. */}
            <body className="flex min-h-full flex-col overflow-x-hidden">
                {/* 헤더가 테마 토글을 렌더하는데 이 호스트에만 부트스트랩이 없어서, 라이트를
                    고른 사용자도 새로고침마다 다크로 돌아왔다(ai·lp·not-found 레이아웃은
                    이미 같은 스크립트를 싣는다). `next/script`의 beforeInteractive는
                    하이드레이션 전에 실행돼 테마 깜빡임도 막는다 — 근거는
                    `ai/[locale]/layout.tsx`와 `shared/lib/theme.ts`. */}
                <Script
                    id="theme-init"
                    strategy="beforeInteractive"
                    dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
                />
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
                        messages={pickMessages(messages, CHROME_CLIENT_PATHS)}
                    >
                        <ReactQueryProvider>
                            {/* 전체화면 검색 오버레이를 앱 전체에 하나만 둔다 — 헤더와
                            홈 히어로가 같은 인스턴스를 연다. 근거는
                            SearchOverlayProvider JSDoc.

                            마스터는 이것을 루트 레이아웃에 뒀는데, 이 브랜치의
                            루트는 패스스루라 `<html lang>`도 프로바이더도 없다
                            (`[locale]/layout.tsx`가 렌더한다). 오버레이는 번역된
                            문구를 쓰므로 `NextIntlClientProvider` **안**이어야
                            한다 — 루트에 두면 로케일 컨텍스트 밖이 된다. */}
                            <NavigationPendingProvider>
                                <SearchOverlayProvider>
                                    {/* 방문자 집계 비콘. 렌더 결과가 없고 하루 한 번만 요청하므로 어느
                                    위치에 두어도 무방하지만, 다른 UI보다 먼저 보내 이탈이 빠른
                                    방문자도 잡는다. */}
                                    <VisitorPing />
                                    <PwaBanner />
                                    <NoticePopupLoader />
                                    {/* 분석 스트림이 비회원 생성 한도에 걸리면 가입 유도
                                    모달을 띄운다. 분석은 여러 라우트(종목·허브)에서
                                    나오므로 루트에 하나만 둔다. */}
                                    <AnalysisRateLimitModalHost />
                                    {/* 인증 헤더는 클라이언트에서 렌더된다(cookies()를 static render
                        트리에서 제거 → 전 라우트 ISR 가능). 상세는 AuthSessionHeaderClient JSDoc. */}
                                    <AuthSessionHeaderClient />
                                    {/* 다른 라우트로 가는 이동은 클릭 즉시 목적지 모양의 골격으로
                                    바꾼다. 클라이언트 상태라 직접 접속·SSR·404에는 관여하지
                                    않는다(`RoutePendingSlot` JSDoc). */}
                                    <RoutePendingSlot>
                                        {children}
                                    </RoutePendingSlot>
                                    {/* Footer를 root layout에 두는 이유: home/404/legal 페이지에만
                        footer가 있어 /market, /backtesting, /[symbol]/* 등 대부분 라우트
                        에 내부 링크가 누수됐다. 차트 페이지(/[symbol])는 SymbolLayout의
                        sticky-footer jail(`min-h-[calc(100dvh-3.5rem)]`)이 chart+AI를
                        첫 viewport에 가득 채우고, footer는 jail의 형제로 그 아래에
                        위치한다 — 사용자가 스크롤을 내리면 footer가 보인다. */}
                                    <Footer />
                                </SearchOverlayProvider>
                            </NavigationPendingProvider>
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
                {/* Google Ads 전환 측정. 운영 빌드에서 ID가 있을 때만 로드한다 —
                    판단 근거는 shared/config/googleAds.ts. */}
                {GOOGLE_ADS_ID && <GoogleAdsTag id={GOOGLE_ADS_ID} />}
            </body>
        </html>
    );
}
