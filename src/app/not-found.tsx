/* eslint-disable nextjs/no-html-link-for-pages --
 * 아래 링크는 `<Link>`가 아니라 `<a>`여야 한다. 이 파일은 루트 레이아웃 바깥에서
 * 자체 문서를 렌더하는 자리라 앱 라우터 컨텍스트가 없고, 전체 페이지 로드로 앱을
 * 처음부터 세우는 것이 유일하게 정상 동작하는 경로다. */
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { AI_PRODUCT_NAME } from '@/app/ai/[locale]/aiSeo';
import { NAV_VERTICALS } from '@/shared/config/assetClassNav';
import {
    LOCALE_HREFLANG,
    localePath,
    type Locale,
} from '@/shared/i18n/locales';
import {
    resolveRequestSurface,
    type RequestSurface,
} from '@/shared/i18n/requestSurface';
import { SITE_NAME } from '@/shared/lib/seo';
import { ThemeInitScript } from '@/shared/ui/ThemeInitScript';
import './globals.css';

/**
 * 이 경계는 `[locale]` 세그먼트가 **해석되지 않은** 자리라 `params`가 없다 —
 * 로케일과 호스트를 요청 헤더에서 읽는다(`resolveRequestSurface`).
 *
 * **의도적으로 동적이다.** `headers()`를 읽으므로 404마다 서버가 렌더한다. 정적이면
 * 한국어 메인 호스트용 한 벌이 모든 로케일·호스트(`/en/foo/bar`, ai.siglens.io)에 그대로
 * 나가 언어와 홈 링크가 틀린다. 404 렌더는 DB·외부 API 없이 카탈로그 조회만 하는 가벼운
 * 작업이라 그 비용을 받아들이고, 로케일·호스트가 맞는 쪽을 택했다. 헤더 읽기를 정적
 * 대체물(쿠키 없는 기본값)로 바꾸지 말 것 — 그건 이 파일이 막으려던 회귀다.
 */
async function readSurface(): Promise<RequestSurface> {
    return resolveRequestSurface(await headers());
}

const HOME_NAMESPACE = 'app.home';
const AI_NAMESPACE = 'app.ai';

/**
 * 제목은 로케일·호스트를 따른다. 예전에는 `'페이지를 찾을 수 없습니다 / Page not
 * found'` 병기 정적 문자열이라, 영어·일본어·중국어 사용자와 SiglensAI 사용자도
 * 전부 한국어가 섞인 탭 제목을 봤다. 이 경계의 본문은 SSR되므로(아래 JSDoc) 제목과
 * 본문이 같은 언어여야 한다.
 */
export async function generateMetadata(): Promise<Metadata> {
    const { locale, onAiHost } = await readSurface();
    const title = onAiHost
        ? (await getTranslations({ locale, namespace: AI_NAMESPACE }))(
              'not-found.pageTitle'
          )
        : (await getTranslations({ locale, namespace: HOME_NAMESPACE }))(
              'not-found.6cbd6d'
          );
    return {
        title: `${title} | ${onAiHost ? AI_PRODUCT_NAME : SITE_NAME}`,
        robots: { index: false, follow: true },
    };
}

const WORDMARK_CLASSES =
    'inline-flex min-h-11 items-center rounded px-1 font-mono text-sm font-semibold tracking-[0.15em] text-secondary-100 uppercase focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';
const NAV_LINK_CLASSES =
    'inline-flex min-h-11 items-center rounded px-2 text-sm font-semibold text-secondary-400 transition-colors hover:text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';
const PRIMARY_LINK_CLASSES =
    'mt-8 inline-flex min-h-11 items-center rounded-lg bg-primary-600 px-6 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';
const SECONDARY_LINK_CLASSES =
    'inline-flex min-h-11 items-center rounded-full border border-border-control px-4 text-xs text-secondary-300 transition-colors hover:border-primary-500 hover:text-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

interface NavLinkItem {
    readonly id: string;
    readonly href: string;
    readonly label: string;
}

interface BrandBarProps {
    readonly wordmark: string;
    readonly homeHref: string;
    /** 메인 호스트의 시장 내비. SiglensAI에는 그 시장 페이지가 없어 비운다. */
    readonly navLabel: string;
    readonly navLinks: readonly NavLinkItem[];
}

/**
 * 정적 브랜드 바. 헤더 위젯(`Header`)은 클라이언트 프로바이더·검색·사용자 메뉴가
 * 얽혀 있어 이 자리(프로바이더가 없는 루트)에서 쓸 수 없다 — 같은 높이(`h-14`)와
 * 하단 보더만 맞춘 워드마크 + 시장 내비 링크다.
 */
function BrandBar({ wordmark, homeHref, navLabel, navLinks }: BrandBarProps) {
    return (
        <header className="border-b border-secondary-700 bg-secondary-900">
            <div className="flex h-14 items-center gap-2 px-4 sm:gap-4">
                <a href={homeHref} translate="no" className={WORDMARK_CLASSES}>
                    {wordmark}
                </a>
                {navLinks.length > 0 && (
                    <nav
                        aria-label={navLabel}
                        className="hidden items-center gap-1 sm:flex"
                    >
                        {navLinks.map(link => (
                            <a
                                key={link.id}
                                href={link.href}
                                className={NAV_LINK_CLASSES}
                            >
                                {link.label}
                            </a>
                        ))}
                    </nav>
                )}
            </div>
        </header>
    );
}

interface NotFoundBodyProps {
    readonly title: string;
    readonly description?: string;
    readonly homeHref: string;
    readonly homeLabel: string;
    readonly shortcuts: readonly NavLinkItem[];
}

function NotFoundBody({
    title,
    description,
    homeHref,
    homeLabel,
    shortcuts,
}: NotFoundBodyProps) {
    return (
        <>
            <p className="font-mono text-sm tracking-widest text-primary-400">
                404
            </p>
            <h1 className="mt-4 text-2xl font-bold text-secondary-100">
                {title}
            </h1>
            {description && (
                <p className="mt-3 max-w-md text-sm leading-relaxed text-secondary-400">
                    {description}
                </p>
            )}
            <a href={homeHref} className={PRIMARY_LINK_CLASSES}>
                {homeLabel}
            </a>
            {shortcuts.length > 0 && (
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                    {shortcuts.map(link => (
                        <a
                            key={link.id}
                            href={link.href}
                            className={SECONDARY_LINK_CLASSES}
                        >
                            {link.label}
                        </a>
                    ))}
                </div>
            )}
        </>
    );
}

const NAV_LABEL_KEY = 'widgets.layout.HeaderNav.5281d7';

async function buildNavLinks(locale: Locale): Promise<NavLinkItem[]> {
    const tNav = await getTranslations({ locale });
    return NAV_VERTICALS.map(vertical => ({
        id: vertical.id,
        href: localePath(locale, vertical.rootHref),
        label: tNav(vertical.labelKey),
    }));
}

async function buildSiteBody(
    locale: Locale,
    homeHref: string
): Promise<NotFoundBodyProps> {
    const t = await getTranslations({ locale, namespace: HOME_NAMESPACE });
    return {
        title: t('not-found.6cbd6d'),
        description: t('not-found.03ecab').replace(/\s+/gu, ' ').trim(),
        homeHref,
        homeLabel: t('not-found.ba81f0', { v0: SITE_NAME }),
        shortcuts: [
            {
                id: 'market',
                href: localePath(locale, '/market'),
                label: t('NotFoundContent.ade95e'),
            },
            {
                id: 'news',
                href: localePath(locale, '/news'),
                label: t('NotFoundContent.91dd85'),
            },
        ],
    };
}

async function buildAiBody(
    locale: Locale,
    homeHref: string
): Promise<NotFoundBodyProps> {
    const t = await getTranslations({ locale, namespace: AI_NAMESPACE });
    return {
        title: t('not-found.pageTitle'),
        homeHref,
        homeLabel: t('not-found.04598e'),
        shortcuts: [],
    };
}

/**
 * 루트 404 — 어떤 라우트에도 매칭되지 않은 URL(`/foo/bar`, `/en/foo/bar`,
 * 알 수 없는 `/lp/*`, SiglensAI 호스트의 없는 경로)이 닿는다.
 *
 * ## 왜 필요한가
 *
 * 전 라우트가 `[locale]/` 아래로 이동하면서, `src/app/layout.tsx`(루트 레이아웃)는
 * `<html>`/`<body>`를 렌더하지 않는 패스스루로 남았다 — 그건 `[locale]/layout.tsx`가
 * 로케일별로 맡는다. 그러면 **어떤 라우트에도 매칭되지 않은 URL**은 로케일 레이아웃
 * 바깥에서 처리되고, Next의 내부 셸(`<html id="__next_error__">`, `lang` 없음, 본문 없음)이
 * 뜬다. 그래서 이 파일이 `<html>`/`<body>`와 스타일시트를 직접 맡는다
 * (`global-error.tsx`와 같은 이유).
 *
 * ## 언어
 *
 * 한때 로케일을 알 수 없어 한국어·영어를 병기했다. 지금은 미들웨어가 남긴 헤더에서
 * 로케일과 호스트를 읽어(`resolveRequestSurface`) **한 언어**로만 렌더한다 — 문구는
 * `[locale]/not-found.tsx`(`NotFoundContent`)와 같은 카탈로그 키를 쓴다. 헤더가 없으면
 * 한국어·메인 호스트다. 링크는 전체 페이지 로드가 되도록 맨 `<a>`다.
 */
export default async function RootNotFound() {
    const { locale, onAiHost } = await readSurface();
    const homeHref = localePath(locale, '/');
    const body = onAiHost
        ? await buildAiBody(locale, homeHref)
        : await buildSiteBody(locale, homeHref);
    const navLinks = onAiHost ? [] : await buildNavLinks(locale);
    const tNav = await getTranslations({ locale });
    return (
        <html lang={LOCALE_HREFLANG[locale]} suppressHydrationWarning>
            <head>
                <ThemeInitScript />
            </head>
            <body className="flex min-h-dvh flex-col bg-secondary-900 text-secondary-50">
                <BrandBar
                    wordmark={onAiHost ? AI_PRODUCT_NAME : SITE_NAME}
                    homeHref={homeHref}
                    navLabel={tNav(NAV_LABEL_KEY)}
                    navLinks={navLinks}
                />
                <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
                    <NotFoundBody {...body} />
                </main>
            </body>
        </html>
    );
}
