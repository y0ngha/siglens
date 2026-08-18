import type { Metadata } from 'next';
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
    '미국 일반·주식·외환·마켓 아티클 카테고리의 최신 뉴스를 한국어 AI 요약과 함께 한 곳에서 봐요.'
);

/**
 * 이 페이지는 2026-08 이전 `/news`의 역할을 그대로 이어받았다.
 *
 * `/news`가 미국·한국·암호화폐 3지역 상위 허브가 되면서, "미국 카테고리 목록"이
 * 갈 곳이 필요해졌다. 구 `/news`로 유입되던 질의(`미국 시장 뉴스`, 리브랜딩 전
 * 표기인 `미국 마켓 뉴스`)를 여기가 승계한다 — 그래서 키워드 목록도 함께 옮겼다.
 */
export function generateMetadata(): Metadata {
    const url = `${SITE_URL}${PATH}`;
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
        alternates: { canonical: PATH },
        openGraph: {
            type: 'website',
            siteName: SITE_NAME,
            title: FULL_TITLE,
            description: DESCRIPTION,
            url,
            locale: 'ko_KR',
        },
        twitter: {
            card: 'summary_large_image',
            title: FULL_TITLE,
            description: DESCRIPTION,
        },
    };
}

export default async function UsNewsHubPage() {
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
        { name: '시장 뉴스 허브', url: `${SITE_URL}/news` },
        { name: '미국 시장 뉴스', url },
    ]);

    return (
        <>
            <JsonLd data={webPageJsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
                <RegionTabs vertical="news" active="us" />
                <h1 className="text-2xl font-bold tracking-tight text-balance text-secondary-100 sm:text-3xl">
                    미국 시장 뉴스
                </h1>
                <div className="space-y-1 text-sm text-secondary-400">
                    <p>
                        미국 일반·주식·외환·마켓 아티클 최신 뉴스를 AI가
                        한국어로 정리해 드려요.
                    </p>
                    <p>
                        각 카테고리는 AI 다이제스트와 함께 호재·악재 시그널을
                        표시하며, 카드 클릭 시 원문 기사로 이동합니다.
                    </p>
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
