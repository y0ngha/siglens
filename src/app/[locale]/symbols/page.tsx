import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { INTL_LOCALE, resolveLocale } from '@/shared/i18n/locales';
import {
    localeAlternatesFrom,
    localePageSocial,
    localePageRobots,
} from '@/shared/lib/seoAlternates';
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
import { enterLocale } from '@/shared/lib/enterLocale';
import { shortenRevalidateIfDatabaseMissingAtBuild } from '@/shared/cache/buildDegradedRevalidate';

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

function symbolsTitle(t: SeoTranslator): string {
    return t('symbols.title');
}

function symbolsFullTitle(t: SeoTranslator): string {
    return `${symbolsTitle(t)} | ${SITE_NAME}`;
}

function symbolsDescription(t: SeoTranslator): string {
    return clampSeoDescription(t('symbols.description'));
}

export async function generateMetadata({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale: rawLocale } = await params;
    const locale = resolveLocale(rawLocale);
    const tSeo = await getTranslations({
        locale,
        namespace: 'shared.seo',
    });
    return {
        title: symbolsTitle(tSeo),
        description: symbolsDescription(tSeo),
        // canonical은 넘기지 않는다 — `localeAlternatesFrom`이 로케일별 자기참조
        // URL을 만든다(ko 절대 URL을 넘기면 `/en/…`이 ko를 가리켜 hreflang 상호참조가
        // 깨진다).
        alternates: await localeAlternatesFrom(params, PATH),
        robots: localePageRobots(locale),
        // 소셜 카드는 `localePageSocial`로 통째로 선언한다 — `og:url`이 canonical과
        // 같은 로케일별 URL이 되고(`/en/symbols`가 ko URL을 가리키지 않게), 정적
        // `/og-image.png`도 함께 실린다(2026-09-18 실측: 이 라우트만 `og:image`가
        // 없었다 — 이미지를 아예 안 주면 공유 카드가 텅 빈 채로 나간다).
        ...localePageSocial(locale, PATH, {
            title: symbolsFullTitle(tSeo),
            description: symbolsDescription(tSeo),
        }),
    };
}

export default async function SymbolsDirectoryPage({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}) {
    const { locale: rawLocale } = await params;
    const locale = enterLocale(rawLocale);
    // 배포 빌드에는 DB가 없다 — 이름/미리보기 없이 구워진 이 렌더를 60초 뒤 재생성하게 한다.
    await shortenRevalidateIfDatabaseMissingAtBuild();
    const [t, tNav, tSeo] = await Promise.all([
        getTranslations('app.symbols'),
        getTranslations(),
        getTranslations('shared.seo'),
    ]);

    // 이름은 로케일에 맞는 것을 읽는다(ko는 한글명, 나머지는 영문명). 못 읽으면
    // 빈 맵이 와서 티커만 찍힌다 — 링크는 어떤 경우에도 남는다.
    const names = await loadSymbolNames(
        [...POPULAR_TICKERS, ...POPULAR_CRYPTOS],
        locale
    );
    const sections = buildSymbolDirectory(names, INTL_LOCALE[locale]);

    const webPageJsonLd = buildWebPageJsonLd({
        url: `${SITE_URL}${PATH}`,
        name: symbolsFullTitle(tSeo),
        description: symbolsDescription(tSeo),
        locale,
    });
    // 브레드크럼·h1은 짧은 제목을 쓴다. `<title>`의 자산군 꼬리표
    // (`— 미국·한국 주식과 암호화폐`)는 검색 결과용이라 화면에 반복하면 군더더기고,
    // BreadcrumbList의 `name`은 **화면에 보이는 마디와 같아야** 구글이 마크업을
    // 무시하지 않는다.
    const heading = t('page.heading');
    const breadcrumbJsonLd = buildBreadcrumbJsonLd(
        [{ name: heading, url: `${SITE_URL}${PATH}` }],
        locale
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
                                        // 모바일은 두 칸이라 `삼성바이오로직스 (207940.KS)`가
                                        // 말줄임으로 잘리면 어느 종목인지 알 수 없다 — 줄바꿈하고
                                        // (한글은 어절 단위 `break-keep`, 긴 티커는 `wrap-break-word`),
                                        // 칸이 넓은 `sm` 이상에서만 한 줄 말줄임을 쓴다.
                                        className="block rounded text-sm wrap-break-word break-keep text-secondary-300 transition-colors hover:text-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none sm:truncate"
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
