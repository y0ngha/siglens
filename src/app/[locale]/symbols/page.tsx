import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { DEFAULT_LOCALE, isLocale } from '@/shared/i18n/locales';
import {
    localeAlternatesFrom,
    localeOpenGraph,
    localeRobots,
} from '@/shared/lib/seoAlternates';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
import { Breadcrumb } from '@/shared/ui/Breadcrumb';
import { JsonLd } from '@/shared/ui/JsonLd';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import {
    buildBreadcrumbJsonLd,
    buildWebPageJsonLd,
    clampSeoDescription,
    SITE_NAME,
    SITE_URL,
    SYMBOLS_PATH,
    type SeoTranslator,
} from '@/shared/lib/seo';
import { buildSymbolDirectory } from '@/shared/lib/symbolDirectory';
import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import { loadSymbolNames } from './loadSymbolNames';

/**
 * 종목 디렉터리 — **내부 링크 고아를 없애는 페이지**다.
 *
 * 2026-09-18 실측: sitemap 심볼 416개 중 147개가 홈에서 3클릭 안에 닿지 않았다
 * (깊이 2에서 sitemap 도달 27%, 깊이 3에서 51%). 큐레이션 카테고리 84개만 화면에
 * 링크돼 있고 나머지는 `RelatedSymbols` 링에 걸린 것만 발견되기 때문이다. 이
 * 페이지가 푸터(전 라우트)에서 1클릭이므로 목록의 모든 종목이 2클릭이 된다.
 *
 * **문구는 "더 보기"다 — "전체/모든 종목"이 아니다.** 상장 종목 전체가 아니라
 * 우리가 분석을 제공하는 목록이라, 전체라고 쓰면 페이지가 지키지 못하는 약속이 된다.
 *
 * 목록 자체는 상수(`POPULAR_TICKERS`·`POPULAR_CRYPTOS`)라 배포로만 바뀌지만, 표기
 * 이름은 DB에서 온다(`korean_tickers`·`crypto_assets`). DB가 본문을 쥔 정적 페이지는
 * `revalidate` 없이는 응답이 사실상 영구 캐시로 굳어 이름을 고쳐도 화면이 안 바뀐다.
 */
export const revalidate = 86400; // 24h — 이름 캐시 TTL과 같다

const PATH = SYMBOLS_PATH;

export function symbolsTitle(t: SeoTranslator): string {
    return t('symbols.title');
}

function symbolsFullTitle(t: SeoTranslator): string {
    return `${symbolsTitle(t)} | ${SITE_NAME}`;
}

export function symbolsDescription(t: SeoTranslator): string {
    return clampSeoDescription(t('symbols.description'));
}

export async function generateMetadata({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale } = await params;
    const resolvedLocale = isLocale(locale) ? locale : DEFAULT_LOCALE;
    const tSeo = await getTranslations({
        locale: resolvedLocale,
        namespace: 'shared.seo',
    });
    return {
        title: symbolsTitle(tSeo),
        description: symbolsDescription(tSeo),
        // canonical은 넘기지 않는다 — `localeAlternatesFrom`이 로케일별 자기참조
        // URL을 만든다(ko 절대 URL을 넘기면 `/en/…`이 ko를 가리켜 hreflang 상호참조가
        // 깨진다).
        alternates: await localeAlternatesFrom(params, PATH),
        robots: localeRobots(resolvedLocale),
        openGraph: {
            type: 'website',
            siteName: SITE_NAME,
            title: symbolsFullTitle(tSeo),
            description: symbolsDescription(tSeo),
            url: `${SITE_URL}${PATH}`,
            ...localeOpenGraph(resolvedLocale),
            // 정적 이미지를 쓴다 — 이 페이지에는 종목별 동적 OG를 만들 근거가 없고,
            // 이미지를 아예 안 주면 공유 카드가 텅 빈 채로 나간다(2026-09-18 실측:
            // 이 라우트만 `og:image`가 없었다).
            images: [
                {
                    url: '/og-image.png',
                    width: OG_IMAGE_WIDTH,
                    height: OG_IMAGE_HEIGHT,
                    alt: symbolsFullTitle(tSeo),
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title: symbolsFullTitle(tSeo),
            description: symbolsDescription(tSeo),
            images: ['/og-image.png'],
        },
    };
}

export default async function SymbolsDirectoryPage({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    // 정적 렌더 활성화. 이 호출이 없으면 next-intl의 서버 API가 `headers()`로
    // 폴백해 이 라우트의 ISR이 통째로 꺼진다(다른 정적 라우트와 같은 이유).
    setRequestLocale(locale);
    const resolvedLocale = isLocale(locale) ? locale : DEFAULT_LOCALE;
    const [t, tNav, tSeo] = await Promise.all([
        getTranslations('app.symbols'),
        getTranslations(),
        getTranslations('shared.seo'),
    ]);

    // 이름은 로케일에 맞는 것을 읽는다(ko는 한글명, 나머지는 영문명). 못 읽으면
    // 빈 맵이 와서 티커만 찍힌다 — 링크는 어떤 경우에도 남는다.
    const names = await loadSymbolNames(
        [...POPULAR_TICKERS, ...POPULAR_CRYPTOS],
        resolvedLocale
    );
    const sections = buildSymbolDirectory(names);

    const webPageJsonLd = buildWebPageJsonLd({
        url: `${SITE_URL}${PATH}`,
        name: symbolsFullTitle(tSeo),
        description: symbolsDescription(tSeo),
        locale: resolvedLocale,
    });
    // 브레드크럼·h1은 짧은 제목을 쓴다. `<title>`의 자산군 꼬리표
    // (`— 미국·한국 주식과 암호화폐`)는 검색 결과용이라 화면에 반복하면 군더더기고,
    // BreadcrumbList의 `name`은 **화면에 보이는 마디와 같아야** 구글이 마크업을
    // 무시하지 않는다.
    const heading = t('page.heading');
    const breadcrumbJsonLd = buildBreadcrumbJsonLd(
        [{ name: heading, url: `${SITE_URL}${PATH}` }],
        resolvedLocale
    );

    return (
        <>
            <JsonLd data={webPageJsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            {/*
             * `ItemList`는 싣지 않는다. 416개 항목이면 JSON-LD만 50KB 가까이
             * 늘어나는데, 크롤러가 이 페이지에서 얻어야 하는 것은 링크 자체이고
             * 그건 이미 `<a>`로 있다.
             */}
            <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8">
                <Breadcrumb trail={[{ label: heading }]} />
                <header className="space-y-2">
                    <h1 className="text-2xl font-bold tracking-tight text-balance text-secondary-50 sm:text-3xl">
                        {heading}
                    </h1>
                    <p className="text-sm text-secondary-400">
                        {t('page.intro')}
                    </p>
                </header>
                {sections.map(section => (
                    <section key={section.id} className="space-y-3">
                        <h2
                            id={`symbols-${section.id}`}
                            className="text-lg font-semibold text-secondary-100"
                        >
                            {tNav(section.labelKey)}
                            <span className="ml-2 text-sm font-normal text-secondary-500">
                                {section.items.length}
                            </span>
                        </h2>
                        <ul
                            aria-labelledby={`symbols-${section.id}`}
                            className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-4"
                        >
                            {section.items.map(item => (
                                <li key={item.symbol} className="min-w-0">
                                    <Link
                                        href={`/${item.symbol}`}
                                        // 400여 개 링크에 prefetch가 붙으면 진입만으로
                                        // 수백 개 `_rsc` 요청이 나간다
                                        // (docs/architecture/CDN_CACHING.md §1).
                                        prefetch={false}
                                        className="block truncate rounded text-sm text-secondary-300 transition-colors hover:text-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                                    >
                                        {item.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </section>
                ))}
            </main>
        </>
    );
}
