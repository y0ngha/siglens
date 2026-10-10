/* eslint-disable nextjs/no-html-link-for-pages --
 * 아래 링크는 `<Link>`가 아니라 `<a>`여야 한다. 이 파일은 루트 레이아웃 바깥에서
 * 자체 문서를 렌더하는 자리라 앱 라우터 컨텍스트가 없고, 전체 페이지 로드로 앱을
 * 처음부터 세우는 것이 유일하게 정상 동작하는 경로다. */
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { NotFoundLayout } from '@/app/_components/NotFoundLayout';
import {
    documentTitleOf,
    buildOverrides,
} from '@/app/_components/notFoundOverrides';
import { NotFoundView } from '@/app/_components/NotFoundView';
import { NAV_VERTICALS } from '@/shared/config/assetClassNav';
import { DEFAULT_LOCALE, localePath } from '@/shared/i18n/locales';
import { SITE_NAME } from '@/shared/config/brand';
import { brandName } from '@/shared/lib/brandName';
import { ThemeInitScript } from '@/shared/ui/ThemeInitScript';
import './globals.css';

const HOME_NAMESPACE = 'app.home';
const NAV_LABEL_KEY = 'widgets.layout.HeaderNav.5281d7';

/**
 * ⚠️ `title`을 두지 않는다 — 제목은 `NotFoundLayout`의 `<title>`이 맡는다. Next 메타데이터의
 * `<title>`은 하이드레이션 때 다시 써져서 클라이언트 섬이 바꾼 제목(`NotFoundView`)을 덮는다.
 */
export function generateMetadata(): Metadata {
    return { robots: { index: false, follow: true } };
}

/**
 * 루트 404 — 어떤 라우트에도 매칭되지 않은 URL(`/foo/bar`, `/en/foo/bar`,
 * 알 수 없는 `/lp/*`, SIGLENS AI 호스트의 없는 경로)이 닿는다.
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
 * ## ⚠️ 반드시 정적이어야 한다 — 요청 API 금지
 *
 * 이 경계는 **모든 라우트 트리의 일부로 함께 렌더된다.** 여기서 `headers()`·`cookies()`·
 * `connection()` 같은 동적 API를 부르면 ISR/정적 페이지 전부가 런타임에 "static에서
 * dynamic으로 바뀌었다"(`Page changed from static to dynamic at runtime /ko/AAPL, reason:
 * headers`)며 500이 된다 — 실측(e2e): `/ko/AAPL`과 알 수 없는 경로가 모두 500이었다.
 * `getTranslations({ locale, namespace })`는 로케일을 인자로 받아 요청 API를 쓰지 않으므로
 * 안전하다.
 *
 * ## 언어·호스트
 *
 * 서버는 한국어 · 메인 호스트 **전체 마크업**을 SSR해 `children`으로 넘기고, 클라이언트 섬
 * (`NotFoundView`)에는 비기본 표면(en/ja/zh 메인, 4개 로케일 ai)의 **최소 문구**만 props로
 * 넘긴다 — 이 요소는 모든 페이지의 Flight 페이로드에 실리므로 props를 키우지 않는다.
 * 섬이 마운트 뒤 주소로 로케일·호스트를 알아내 문구를 바꾼다 — JS 없이 받는 크롤러는
 * 한국어 문서를 받는다.
 * 링크는 전체 페이지 로드가 되도록 맨 `<a>`다.
 */
export default async function RootNotFound() {
    const [overrides, t, tNav] = await Promise.all([
        buildOverrides(),
        getTranslations({ locale: DEFAULT_LOCALE, namespace: HOME_NAMESPACE }),
        getTranslations({ locale: DEFAULT_LOCALE }),
    ]);
    return (
        // `lang`은 서버에서 요청 로케일로 정할 수 없다 — 그 신호(경로·헤더)를 읽는 순간 위
        // "반드시 정적" 제약이 깨진다. 기본 로케일로 SSR하고, `/en/…` 등은 하이드레이션 뒤
        // `NotFoundView`가 `document.documentElement.lang`을 주소의 로케일로 바꾼다
        // (`suppressHydrationWarning`이 그 불일치를 허용한다). e2e `not-found.spec.ts`가 둘 다 본다.
        <html lang={DEFAULT_LOCALE} suppressHydrationWarning>
            <head>
                <ThemeInitScript />
            </head>
            <body className="flex min-h-dvh flex-col bg-secondary-900 text-secondary-50">
                <NotFoundView overrides={overrides}>
                    <NotFoundLayout
                        wordmark={SITE_NAME}
                        homeHref={localePath(DEFAULT_LOCALE, '/')}
                        documentTitle={documentTitleOf(
                            t('not-found.6cbd6d'),
                            brandName(DEFAULT_LOCALE)
                        )}
                        navLabel={tNav(NAV_LABEL_KEY)}
                        navLinks={NAV_VERTICALS.map(vertical => ({
                            id: vertical.id,
                            href: localePath(DEFAULT_LOCALE, vertical.rootHref),
                            label: tNav(vertical.labelKey),
                        }))}
                        title={t('not-found.6cbd6d')}
                        description={t('not-found.03ecab')
                            .replace(/\s+/gu, ' ')
                            .trim()}
                        homeLabel={t('not-found.ba81f0', {
                            v0: brandName(DEFAULT_LOCALE),
                        })}
                        shortcuts={[
                            {
                                id: 'market',
                                href: localePath(DEFAULT_LOCALE, '/market'),
                                label: t('NotFoundContent.ade95e'),
                            },
                            {
                                id: 'news',
                                href: localePath(DEFAULT_LOCALE, '/news'),
                                label: t('NotFoundContent.91dd85'),
                            },
                        ]}
                    />
                </NotFoundView>
            </body>
        </html>
    );
}
