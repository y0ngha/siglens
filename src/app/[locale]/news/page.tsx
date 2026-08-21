import { getTranslations } from 'next-intl/server';
import type { SeoTranslator } from '@/shared/lib/seo';
import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { DEFAULT_LOCALE, isLocale } from '@/shared/i18n/locales';
import {
    localeAlternatesFrom,
    localeCanonical,
    localeOpenGraph,
    localeRobots,
} from '@/shared/lib/seoAlternates';
import { CATEGORY_CONFIG, categoriesInRegion } from '@/entities/market-news';
import { CategoryCard } from '@/widgets/news-hub';
import { JsonLd } from '@/shared/ui/JsonLd';
import { regionsOf, type NavRegionId } from '@/shared/config/assetClassNav';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { fetchCategoryPreviews } from './_lib/categoryPreviews';
import {
    buildBreadcrumbJsonLd,
    buildWebPageJsonLd,
    clampSeoDescription,
    SITE_NAME,
    SITE_URL,
} from '@/shared/lib/seo';

// 24h ISR — 허브 인덱스는 지역 구조가 바뀌지 않는 한 신선도가 낮아도 무방.
// 카드별 헤드라인은 staticSymbolCache(24h TTL)를 통해 캐싱된다 — 페이지 revalidate와
// TTL을 맞춰 s-maxage가 1h로 clamp되지 않도록 한다.
export const revalidate = 86400;

const NEWS_HUB_PATH = '/news';
/**
 * 3지역 커버리지를 밝히는 문구 — `src/app/__tests__/supportedAssets.test.ts`가
 * 여기서 자산군 누락을 검사한다. 커버리지 문구가 여러 표면에 프로즈로 흩어져
 * 한쪽만 갱신되는 것이 이 저장소에서 세 라운드 반복된 결함이다
 * (`docs/workflows/MISTAKES.md` §6.6).
 */
export function newsHubTitle(t: SeoTranslator): string {
    return t('newsHub.title');
}
function newsHubFullTitle(t: SeoTranslator): string {
    return `${newsHubTitle(t)} | ${SITE_NAME}`;
}
export function newsHubDescription(t: SeoTranslator): string {
    return clampSeoDescription(t('newsHub.description'));
}

/**
 * 이 페이지는 **미국 허브에서 3지역 상위 허브로 승격**된 것이다(2026-08).
 *
 * 이전에는 `/news`가 곧 미국 카테고리 목록이라, 암호화폐 뉴스를 보려면 "미국 시장
 * 뉴스 허브"를 거쳐야 했다 — 자산군이 2차 개념으로 숨어 있던 구조. 미국 카테고리
 * 목록은 `/news/us`가 그대로 이어받았고 미국 관련 질의 키워드도 그쪽이 승계한다.
 * 여기서는 3지역을 나란히 놓아 어느 자산군이든 한 번에 들어가게 한다.
 */
interface LocaleMetadataParams {
    readonly params: Promise<{ locale: string }>;
}

export async function generateMetadata({
    params,
}: LocaleMetadataParams): Promise<Metadata> {
    const { locale } = await params;
    const resolvedLocale = isLocale(locale) ? locale : DEFAULT_LOCALE;
    const ogLocale = localeOpenGraph(resolvedLocale);
    // og:url도 로케일별이어야 한다 — 소셜 언퍼널이 ko URL로 되돌린다.
    const url = localeCanonical(resolvedLocale, NEWS_HUB_PATH);
    // 지역 카드 미리보기가 전부 비면 본문이 제목·설명뿐이라 thin으로 판정될 분량이다.
    // 자매 라우트와 같은 규약: canonical을 비우고 noindex, follow는 유지.
    const previews = await Promise.all(
        regionsOf('news').map(region =>
            fetchCategoryPreviews(
                previewCategoryOf(region.region),
                isLocale(locale) ? locale : DEFAULT_LOCALE
            )
        )
    );
    const degraded = previews.every(list => list.length === 0);
    const tSeo = await getTranslations({
        locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
        namespace: 'shared.seo',
    });
    return {
        title: newsHubTitle(tSeo),
        description: newsHubDescription(tSeo),
        /*
         * **지역 head term은 하나도 넣지 않는다.**
         *
         * `미국 시장 뉴스`는 `/news/us`가, `한국 증시 뉴스`·`코스피 뉴스`는
         * `/news/kr`이, `암호화폐 뉴스`는 `/news/crypto`가 각각 title·h1·본문으로
         * 정면 타게팅한다(`REGION_KEYWORDS` 참조). 허브가 같은 말을 또 하면 같은
         * 질의를 두 URL이 나눠 갖고, 구글은 보통 더 오래된 쪽(=허브)을 고르는데
         * 그쪽이 주제로는 더 얕다.
         *
         * 허브가 노릴 것은 "어느 시장인지 아직 안 정한" 상위 질의뿐이다.
         */
        keywords: [
            '시장 뉴스',
            '주식 뉴스',
            '시장 뉴스 한국어',
            'AI 뉴스 다이제스트',
            'Siglens 뉴스',
        ],
        alternates: await localeAlternatesFrom(params, NEWS_HUB_PATH, {
            // canonical은 넘기지 않는다 — `localeAlternatesFrom`이 로케일별
            // 자기참조 URL을 만든다. ko 절대 URL을 넘기면 `/en/…`이 ko를
            // canonical로 가리켜 hreflang 상호참조가 깨진다.
            canonical: degraded ? null : undefined,
        }),
        robots: degraded
            ? { index: false, follow: true }
            : localeRobots(resolvedLocale),
        openGraph: {
            type: 'website',
            siteName: SITE_NAME,
            title: newsHubFullTitle(tSeo),
            description: newsHubDescription(tSeo),
            url,
            ...ogLocale,
        },
        twitter: {
            card: 'summary_large_image',
            title: newsHubFullTitle(tSeo),
            description: newsHubDescription(tSeo),
        },
    };
}

/**
 * 지역 카드의 미리보기는 그 지역의 **첫 카테고리**에서 가져온다.
 *
 * 미국은 카테고리가 4개라 어느 하나를 골라야 하는데, `categoriesInRegion`이
 * `CATEGORY_CONFIG` 선언 순서를 그대로 주므로 첫 항목(`general` = 미국 일반 시장)이
 * 가장 넓은 피드다. 한국·암호화폐는 카테고리가 하나뿐이라 선택의 여지가 없다.
 * 별도 상수를 두지 않는 이유: 상수를 두면 카테고리를 추가할 때 두 곳을 맞춰야 한다.
 */
function previewCategoryOf(region: NavRegionId) {
    const categories = categoriesInRegion(region);
    const first = categories[0];
    if (first === undefined) {
        throw new Error(`[NewsHubPage] region has no categories: ${region}`);
    }
    return first;
}

/**
 * 지역 카드 설명. `CATEGORY_CONFIG.koDescription`을 재사용하지 않는다 — 그건 단일
 * 카테고리 설명이고, 여기서는 그 지역 전체가 뭘 담는지 말해야 한다(미국은 4개
 * 카테고리를 묶는다).
 */
/**
 * 키만 내보낸다 — `t()` 호출은 번역자를 **선언한** 렌더 쪽에서 한다.
 * 여기서 `t`를 인자로 받아 부르면 추출기가 그 파일을 건너뛰어 키가 클라이언트
 * 페이로드에서 누락된다(`noTranslatorParamCall` 가드가 막는 패턴).
 */
const REGION_DESCRIPTION_KEY: Record<NavRegionId, string> = {
    us: 'regionDescription.us',
    kr: 'regionDescription.kr',
    crypto: 'regionDescription.crypto',
};

export default async function NewsHubPage({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    // 정적 렌더 활성화. 이 호출이 없으면 next-intl의 서버 API가 `headers()`로
    // 폴백해 **이 라우트의 ISR이 통째로 꺼진다**(빌드 route 표에서 `●` → `ƒ`).
    // 실측으로 확인했다 — Next 16.2는 `next/root-params` 미지원이라 이 경로가 유일하다.
    setRequestLocale(locale);
    const tNav = await getTranslations();
    const t = await getTranslations('app.news');
    const tSeo = await getTranslations('shared.seo');
    const regions = regionsOf('news');
    const previews = await Promise.all(
        regions.map(region =>
            fetchCategoryPreviews(
                previewCategoryOf(region.region),
                isLocale(locale) ? locale : DEFAULT_LOCALE
            )
        )
    );

    const hubUrl = `${SITE_URL}${NEWS_HUB_PATH}`;

    const webPageJsonLd = {
        ...buildWebPageJsonLd({
            url: hubUrl,
            name: `${newsHubTitle(tSeo)} | ${SITE_NAME}`,
            description: newsHubDescription(tSeo),
            locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
        }),
    };

    const breadcrumbJsonLd = buildBreadcrumbJsonLd(
        [{ name: t('page.dc06c4'), url: hubUrl }],
        isLocale(locale) ? locale : DEFAULT_LOCALE
    );

    return (
        <>
            <JsonLd data={webPageJsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
                <h1 className="text-2xl font-bold tracking-tight text-balance text-secondary-100 sm:text-3xl">
                    {t('page.dc06c4')}
                </h1>
                <div className="space-y-1 text-sm text-secondary-400">
                    <p>{t('page.17728f')}</p>
                    <p>{t('page.a96e68')}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {regions.map((region, i) => (
                        <CategoryCard
                            key={region.region}
                            label={tNav(region.fullLabelKey)}
                            href={region.href}
                            description={t(
                                REGION_DESCRIPTION_KEY[region.region]
                            )}
                            previewHeadlines={previews[i]}
                        />
                    ))}
                </div>
                {/*
                    미국 4개 카테고리로 가는 직접 링크. 지역 카드만 두면 미국
                    사용자가 원하는 카테고리에 닿기까지 클릭이 두 번 필요하고,
                    구 `/news`(=미국 카테고리 목록)로 쌓인 내부 링크 그래프도
                    한 단계 멀어진다. 목적지는 `/news/us`와 같지만 이쪽은 인덱스,
                    저쪽은 미리보기까지 있는 허브라 중복 콘텐츠가 되지 않는다.
                */}
                <section
                    aria-labelledby="news-hub-category-index"
                    className="rounded-lg border border-secondary-800 bg-secondary-800/30 p-5"
                >
                    <h2
                        id="news-hub-category-index"
                        className="text-base font-semibold text-secondary-300"
                    >
                        {t('page.e02fdd')}
                    </h2>
                    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                        {categoriesInRegion('us').map(cat => (
                            <li key={cat}>
                                <Link
                                    href={`/news/${CATEGORY_CONFIG[cat].slug}`}
                                    // 허브에 다수 렌더 — docs/architecture/CDN_CACHING.md §1
                                    prefetch={false}
                                    className="text-sm text-primary-400 transition-colors hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                                >
                                    {CATEGORY_CONFIG[cat].koLabel}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            </main>
        </>
    );
}
