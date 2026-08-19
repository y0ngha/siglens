import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { DEFAULT_LOCALE, isLocale } from '@/shared/i18n/locales';
import {
    localeAlternatesFrom,
    localeCanonical,
    localeOpenGraph,
} from '@/shared/lib/seoAlternates';
import { CATEGORY_CONFIG, categoriesInRegion } from '@/entities/market-news';
import { CategoryCard } from '@/widgets/news-hub';
import { JsonLd } from '@/shared/ui/JsonLd';
import { RegionTabs } from '@/shared/ui/RegionTabs';
import { fetchCategoryPreviews } from '../_lib/categoryPreviews';
import {
    buildBreadcrumbJsonLd,
    clampSeoDescription,
    SITE_NAME,
    SITE_URL,
} from '@/shared/lib/seo';

// 24h ISR — 허브 인덱스는 카테고리 구조가 바뀌지 않는 한 신선도가 낮아도 무방.
// 카드별 헤드라인은 staticSymbolCache(24h TTL)를 통해 캐싱된다 — 페이지 revalidate와
// TTL을 맞춰 s-maxage가 1h로 clamp되지 않도록 한다.
export const revalidate = 86400;

const PATH = '/news/us';
const TITLE = '미국 시장 뉴스 — 카테고리별 최신 흐름';
const FULL_TITLE = `${TITLE} | ${SITE_NAME}`;
const DESCRIPTION = clampSeoDescription(
    '미국 시장 뉴스를 카테고리별로 한 곳에서 확인해요. 일반·주식·외환·마켓 아티클까지 최신 흐름을 빠짐없이 모았고, 어려운 원문 기사도 한국어 AI 요약으로 핵심만 빠르게 파악할 수 있게 도와드려요.'
);

/**
 * 이 페이지는 2026-08 이전 `/news`의 역할을 그대로 이어받았다.
 *
 * `/news`가 미국·한국·암호화폐 3지역 상위 허브가 되면서, "미국 카테고리 목록"이
 * 갈 곳이 필요해졌다. 구 `/news`로 유입되던 질의(`미국 시장 뉴스`, 리브랜딩 전
 * 표기인 `미국 마켓 뉴스`)를 여기가 승계한다 — 그래서 키워드 목록도 함께 옮겼다.
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
    const localizedUrl = localeCanonical(resolvedLocale, PATH);
    const url = localizedUrl;
    // 미리보기가 하나도 없으면 이 페이지는 h1 + 두 문단 + 카드 제목뿐이라
    // 2026-07 thin-content 사태에서 문제가 된 분량(약 677자)보다도 얇다.
    // 첫인상으로 판정되는 신규 URL이라 그 상태를 색인시키지 않는다.
    const previews = await Promise.all(
        categoriesInRegion('us').map(cat => fetchCategoryPreviews(cat))
    );
    const degraded = previews.every(list => list.length === 0);
    return {
        title: TITLE,
        description: DESCRIPTION,
        keywords: [
            '미국 시장 뉴스',
            // 구 표기. 리브랜딩(2026-08) 전 유입 질의를 잃지 않기 위해 남긴다.
            '미국 마켓 뉴스',
            '미국 주식 뉴스',
            '미국 외환 뉴스',
            '시장 뉴스 한국어',
            '미국 주식 뉴스 요약',
            'AI 뉴스 다이제스트',
            'Siglens 뉴스',
        ],
        alternates: await localeAlternatesFrom(params, PATH, {
            // canonical은 넘기지 않는다 — `localeAlternatesFrom`이 로케일별
            // 자기참조 URL을 만든다. ko 절대 URL을 넘기면 `/en/…`이 ko를
            // canonical로 가리켜 hreflang 상호참조가 깨진다.
            canonical: degraded ? null : undefined,
        }),
        robots: degraded
            ? { index: false, follow: true }
            : { index: true, follow: true },
        openGraph: {
            type: 'website',
            siteName: SITE_NAME,
            title: FULL_TITLE,
            description: DESCRIPTION,
            url,
            ...ogLocale,
            // `/news/opengraph-image.tsx`를 **명시적으로** 가리킨다. 파일 컨벤션은
            // 그 세그먼트에 붙고, 하위 세그먼트가 자기 `openGraph`를 선언하면
            // 상속이 끊긴다 — 그러면 공유 카드에 이미지가 통째로 빠지는데,
            // 빌드/렌더에는 아무 에러도 나지 않아 조용히 넘어간다.
            images: [`${SITE_URL}/news/opengraph-image`],
        },
        twitter: {
            card: 'summary_large_image',
            title: FULL_TITLE,
            description: DESCRIPTION,
            images: [`${SITE_URL}/news/opengraph-image`],
        },
    };
}

export default async function UsNewsHubPage({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    // 정적 렌더 활성화. 이 호출이 없으면 next-intl의 서버 API가 `headers()`로
    // 폴백해 **이 라우트의 ISR이 통째로 꺼진다**(빌드 route 표에서 `●` → `ƒ`).
    // 실측으로 확인했다 — Next 16.2는 `next/root-params` 미지원이라 이 경로가 유일하다.
    setRequestLocale(locale);
    const t = await getTranslations('app.news');
    const categories = categoriesInRegion('us');
    const previewsByCategory = await Promise.all(
        categories.map(cat => fetchCategoryPreviews(cat))
    );

    const url = `${SITE_URL}${PATH}`;

    const webPageJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        name: FULL_TITLE,
        description: DESCRIPTION,
        url,
        inLanguage: 'ko',
        isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}#website` },
    };

    const breadcrumbJsonLd = buildBreadcrumbJsonLd([
        { name: t('page.dc06c4'), url: `${SITE_URL}/news` },
        { name: t('page.d311d2'), url },
    ]);

    return (
        <>
            <JsonLd data={webPageJsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
                <RegionTabs vertical="news" active="us" currentPath={PATH} />
                <h1 className="text-2xl font-bold tracking-tight text-balance text-secondary-100 sm:text-3xl">
                    {t('page.d311d2')}
                </h1>
                <div className="space-y-1 text-sm text-secondary-400">
                    <p>{t('page.d97943')}</p>
                    <p>{t('page.f5e9de')}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {categories.map((cat, i) => {
                        const cfg = CATEGORY_CONFIG[cat];
                        return (
                            <CategoryCard
                                key={cat}
                                koLabel={cfg.koLabel}
                                href={`/news/${cfg.slug}`}
                                koDescription={cfg.koDescription}
                                previewHeadlines={previewsByCategory[i]}
                            />
                        );
                    })}
                </div>
            </main>
        </>
    );
}
