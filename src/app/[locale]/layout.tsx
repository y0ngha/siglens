import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import {
    getMessages,
    getTranslations,
    setRequestLocale,
} from 'next-intl/server';
import { GoogleAdsTag } from '@/app/_components/GoogleAdsTag';
import { SiteChrome } from '@/app/_components/SiteChrome';
import { FONT_VARIABLE_CLASSES } from '@/app/fontVariables';
import { FIRST_INPUT_PROBE_SCRIPT } from '@/features/pwa-install/lib/firstInputProbe';
import { SiteJsonLd } from '@/widgets/layout/SiteJsonLd';
import { SITE_NAME } from '@/shared/config/brand';
import { GOOGLE_ADS_ID } from '@/shared/config/googleAds';
import { SITE_VIEWPORT } from '@/shared/config/viewport';
import { CHROME_CLIENT_PATHS } from '@/shared/i18n/clientNamespaces';
import { pickMessages } from '@/shared/i18n/loadMessages';
import {
    isLocale,
    LOCALE_HREFLANG,
    localePath,
    resolveLocale,
    resolvePrerenderLocales,
    type Locale,
} from '@/shared/i18n/locales';
import { ADSENSE_ENABLED } from '@/shared/lib/adsense';
import { AUTH_HINT_INIT_SCRIPT } from '@/shared/lib/auth/authHintAttribute';
import { brandName, brandTitle } from '@/shared/lib/brandName';
import { CF_BEACON_TOKEN } from '@/shared/lib/cloudflareAnalytics';
import { cn } from '@/shared/lib/cn';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
import { brandIntroName, ROOT_KEYWORDS, SITE_URL } from '@/shared/lib/seo';
import { localeOpenGraph, localePageRobots } from '@/shared/lib/seoAlternates';
import { THEME_INIT_SCRIPT } from '@/shared/lib/theme';
import { buildTwitterMetadata } from '@/shared/lib/twitterMetadata';
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

/**
 * 메인 호스트 전 페이지의 기본 메타데이터(제목 템플릿·설명·OG·twitter·robots·검증 토큰).
 * 페이지가 같은 최상위 키를 선언하면 Next가 병합하지 않고 교체한다.
 */
export async function generateMetadata({
    params,
}: LocaleParams): Promise<Metadata> {
    const { locale: raw } = await params;
    const locale = resolveLocale(raw);
    const siteUrl = `${SITE_URL}${localePath(locale, '/')}`.replace(/\/$/, '');
    // 제목·설명은 로케일 카탈로그에서 푼다 — 한국어 상수를 쓰면 비-ko 로케일의 탭 제목과
    // 공유 카드가 한국어가 된다.
    const tSeo = await getTranslations({ locale, namespace: 'shared.seo' });
    // 브랜드가 제목에 들어가야 "시그렌즈"·"SIGLENS" 검색이 홈으로 온다. 한글 표기는
    // 인자로 넘긴다 — 카탈로그에 직접 적으면 ko 문장만 길어져 번역 검증의 길이 게이트가
    // 다른 로케일을 잘린 번역으로 본다.
    const rootTitle = tSeo('root.title', { v0: brandIntroName(locale) });

    return {
        metadataBase: new URL(SITE_URL),
        title: {
            default: rootTitle,
            template: brandTitle('%s', locale),
        },
        description: tSeo('root.description'),
        // 로케일별 매니페스트. 기본 `/manifest.webmanifest`를 그대로 두면 `/en`에서
        // 설치해도 홈 화면 이름·바로가기가 한국어로 굳는다.
        manifest: localePath(locale, '/manifest.webmanifest'),
        keywords: ROOT_KEYWORDS,
        applicationName: brandName(locale),
        authors: [{ name: SITE_NAME, url: SITE_URL }],
        creator: SITE_NAME,
        openGraph: {
            type: 'website',
            siteName: brandName(locale),
            title: rootTitle,
            description: tSeo('root.description'),
            url: siteUrl,
            // 색인 게이트를 존중하는 단일 출처를 쓴다 — 하드코딩하면 hreflang이 내보내지
            // 않는 미준비 로케일까지 og 대체본으로 광고한다.
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
        // 을 자동 생성하므로 metadata.icons로 중복 선언하지 않는다(같은 이미지가 두 번 링크된다).
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

/** 값과 근거는 `SITE_VIEWPORT` — ai 호스트 루트 레이아웃과 같은 값을 쓴다. */
export const viewport: Viewport = SITE_VIEWPORT;

interface RootLayoutProps {
    readonly children: ReactNode;
    readonly params: Promise<{ locale: string }>;
}

/**
 * 메인 호스트의 문서 셸 — `<html lang>`·`<body>`, 첫 페인트 전 스크립트, 사이트 JSON-LD, 앱 크롬
 * (`SiteChrome`), 서드파티 측정 스크립트. `lang`이 로케일을 따라야 해서 루트가 아니라 이 세그먼트가
 * `<html>`을 소유한다.
 */
export default async function RootLayout({
    children,
    params,
}: RootLayoutProps) {
    const { locale } = await params;
    // `[locale]`은 알 수 없는 최상위 경로(`/unknown.txt`)까지 잡아채는 catch-all처럼
    // 동작한다. 검증하지 않으면 그런 요청이 200으로 렌더돼 soft 404가 된다.
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
            className={cn(
                FONT_VARIABLE_CLASSES,
                'h-full overflow-x-hidden antialiased scheme-dark'
            )}
            // `THEME_INIT_SCRIPT`가 첫 페인트 전에 `<html>`에 `data-theme`과 인라인
            // `color-scheme`을 찍는다. 서버 HTML에는 둘 다 없으므로 React가 불일치로
            // 경고한다 — 의도된 차이라 이 요소에서만 억제한다(자식 트리에는 영향 없음).
            // `scheme-dark` 클래스는 스크립트가 못 도는 환경의 기본값으로 남는다 —
            // 인라인 style이 클래스보다 우선하므로 라이트 사용자에게서 둘이 다투지 않는다.
            suppressHydrationWarning
        >
            {/* html·body 양쪽의 overflow-x-hidden이 fixed/transform 요소(모바일 드로어)가 문서
                scrollWidth를 뷰포트 밖으로 늘리지 않게 막는다. */}
            <body className="flex min-h-full flex-col overflow-x-hidden">
                {/* 하이드레이션 전의 첫 탭·키를 기억한다 — 설치 배너가 effect보다 먼저 온 입력을
                    놓치지 않게. `next/script`가 아니라 인라인이어야 파싱 즉시 실행된다(근거는
                    `features/pwa-install/lib/firstInputProbe.ts`). 루트 레이아웃은 클라이언트에서
                    다시 그려지지 않으므로 "클라이언트 렌더 시 스크립트 미실행" 경고 대상이 아니다. */}
                <script
                    dangerouslySetInnerHTML={{
                        __html: FIRST_INPUT_PROBE_SCRIPT,
                    }}
                />
                {/* 헤더의 테마 토글이 고른 테마를 새로고침 뒤에도 유지하려면 첫 페인트 전에 적용해야
                    한다(ai·lp·not-found 레이아웃도 같은 스크립트를 싣는다). `next/script`의
                    beforeInteractive는 하이드레이션 전에 실행돼 테마 깜빡임도 막는다 — 근거는
                    `shared/lib/theme.ts`. */}
                <Script
                    id="theme-init"
                    strategy="beforeInteractive"
                    dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
                />
                {/* 로그인 추정 표식(`<html data-auth-hint>`)을 첫 페인트 전에 찍는다 — 헤더 인증
                    영역의 폭을 CSS가 처음부터 맞게 잡아 회원의 헤더가 하이드레이션 때 밀리지
                    않게 한다(CLS). 테마 스크립트와 같은 이유로 `beforeInteractive`이고, 의도된
                    `<html>` 속성 차이라 위의 `suppressHydrationWarning`이 함께 덮는다. */}
                <Script
                    id="auth-hint-init"
                    strategy="beforeInteractive"
                    dangerouslySetInnerHTML={{ __html: AUTH_HINT_INIT_SCRIPT }}
                />
                <SiteJsonLd />
                <SiteChrome
                    locale={locale}
                    messages={pickMessages(messages, CHROME_CLIENT_PATHS)}
                >
                    {children}
                </SiteChrome>
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
