import type { Metadata } from 'next';
import { CATEGORY_CONFIG, categoriesInRegion } from '@/entities/market-news';
import { CategoryCard } from '@/widgets/news-hub';
import { JsonLd } from '@/shared/ui/JsonLd';
import { regionsOf, type NavRegionId } from '@/shared/config/assetClassNav';
import Link from 'next/link';
import { fetchCategoryPreviews } from './_lib/categoryPreviews';
import {
    buildBreadcrumbJsonLd,
    clampSeoDescription,
    SITE_NAME,
    SITE_URL,
} from '@/shared/lib/seo';

// 24h ISR — 허브 인덱스는 지역 구조가 바뀌지 않는 한 신선도가 낮아도 무방.
// 카드별 헤드라인은 staticSymbolCache(24h TTL)를 통해 캐싱된다 — 페이지 revalidate와
// TTL을 맞춰 s-maxage가 1h로 clamp되지 않도록 한다.
export const revalidate = 86400;

const NEWS_HUB_PATH = '/news';
const NEWS_HUB_TITLE = '시장 뉴스 허브 — 미국·한국·암호화폐';
const NEWS_HUB_FULL_TITLE = `${NEWS_HUB_TITLE} | ${SITE_NAME}`;
const NEWS_HUB_DESCRIPTION = clampSeoDescription(
    '미국·한국 주식과 암호화폐 시장 뉴스를 지역별로 나눠, 한국어 AI 요약과 함께 한 곳에서 봐요.'
);

/**
 * 이 페이지는 **미국 허브에서 3지역 상위 허브로 승격**된 것이다(2026-08).
 *
 * 이전에는 `/news`가 곧 미국 카테고리 목록이라, 암호화폐 뉴스를 보려면 "미국 시장
 * 뉴스 허브"를 거쳐야 했다 — 자산군이 2차 개념으로 숨어 있던 구조. 미국 카테고리
 * 목록은 `/news/us`가 그대로 이어받았고 미국 관련 질의 키워드도 그쪽이 승계한다.
 * 여기서는 3지역을 나란히 놓아 어느 자산군이든 한 번에 들어가게 한다.
 */
export function generateMetadata(): Metadata {
    const url = `${SITE_URL}${NEWS_HUB_PATH}`;
    return {
        title: NEWS_HUB_TITLE,
        description: NEWS_HUB_DESCRIPTION,
        keywords: [
            '시장 뉴스',
            '미국 시장 뉴스',
            '한국 증시 뉴스',
            '코스피 뉴스',
            '암호화폐 뉴스',
            '시장 뉴스 한국어',
            'AI 뉴스 다이제스트',
            'Siglens 뉴스',
        ],
        alternates: {
            canonical: NEWS_HUB_PATH,
        },
        openGraph: {
            type: 'website',
            siteName: SITE_NAME,
            title: NEWS_HUB_FULL_TITLE,
            description: NEWS_HUB_DESCRIPTION,
            url,
            locale: 'ko_KR',
        },
        twitter: {
            card: 'summary_large_image',
            title: NEWS_HUB_FULL_TITLE,
            description: NEWS_HUB_DESCRIPTION,
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
const REGION_DESCRIPTION: Record<NavRegionId, string> = {
    us: '미국 일반·주식·외환·마켓 아티클 4개 카테고리를 모았습니다.',
    kr: '코스피·코스닥 등 국내 증시 주요 뉴스를 모았습니다.',
    crypto: '비트코인·이더리움 등 주요 암호화폐 시장 동향을 모았습니다.',
};

export default async function NewsHubPage() {
    const regions = regionsOf('news');
    const previews = await Promise.all(
        regions.map(region =>
            fetchCategoryPreviews(previewCategoryOf(region.region))
        )
    );

    const hubUrl = `${SITE_URL}${NEWS_HUB_PATH}`;

    const webPageJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': `${hubUrl}#webpage`,
        name: NEWS_HUB_FULL_TITLE,
        description: NEWS_HUB_DESCRIPTION,
        url: hubUrl,
        inLanguage: 'ko',
        isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}#website` },
    };

    const breadcrumbJsonLd = buildBreadcrumbJsonLd([
        { name: '시장 뉴스 허브', url: hubUrl },
    ]);

    return (
        <>
            <JsonLd data={webPageJsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
                <h1 className="text-2xl font-bold tracking-tight text-balance text-secondary-100 sm:text-3xl">
                    시장 뉴스 허브
                </h1>
                <div className="space-y-1 text-sm text-secondary-400">
                    <p>
                        미국·한국 주식과 암호화폐 뉴스를 지역별로 나눠, AI가
                        한국어로 정리해 드려요.
                    </p>
                    <p>
                        각 카테고리는 AI 다이제스트와 함께 호재·악재 시그널을
                        표시하며, 카드 클릭 시 원문 기사로 이동합니다.
                    </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {regions.map((region, i) => (
                        <CategoryCard
                            key={region.region}
                            koLabel={region.fullLabel}
                            href={region.href}
                            koDescription={REGION_DESCRIPTION[region.region]}
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
                        미국 뉴스 카테고리 바로가기
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
