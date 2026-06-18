import type { NewsFeedCategory } from '@y0ngha/siglens-core';

export interface CategoryConfig {
    /** DB bucket symbol — never shown in a URL. */
    sentinel: string;
    /** FMP `/stable/<path>` for this category's market-wide feed (confirmed in Phase 0). */
    fmpEndpoint: string;
    /** URL slug at /news/<slug>. */
    slug: NewsFeedCategory;
    /**
     * 한국어 카테고리 라벨. **3중 용도**:
     * 1. UI 표시 — 카테고리 페이지 h1 및 hub 카드 heading.
     * 2. JSON-LD ItemList `name` 필드 (`app/news/[category]/page.tsx`).
     * 3. AI 다이제스트 프롬프트 입력 — `submitMarketNewsDigestAction`이 `categoryLabel` 인자로 core에 전달.
     *
     * AI 도메인 입력 역할 때문에 entity/lib/에 두지만, UI + SEO 의존성도 있다는 점을 인지할 것.
     */
    koLabel: string;
    /** 허브 카드 아래 표시하는 한 줄 카테고리 소개. thin-content SEO 방어용. */
    koDescription: string;
}

export const CATEGORY_CONFIG: Record<NewsFeedCategory, CategoryConfig> = {
    general: {
        sentinel: '__NEWS_GENERAL__',
        fmpEndpoint: 'news/general-latest',
        slug: 'general',
        koLabel: '미국 일반 시장',
        koDescription: '미국 전반적인 시장 흐름과 거시 경제 소식을 모았습니다.',
    },
    stock: {
        sentinel: '__NEWS_STOCK__',
        fmpEndpoint: 'news/stock-latest',
        slug: 'stock',
        koLabel: '미국 주식',
        koDescription:
            '미국 주식 시장의 주요 종목 뉴스와 실적 이슈를 모았습니다.',
    },
    crypto: {
        sentinel: '__NEWS_CRYPTO__',
        fmpEndpoint: 'news/crypto-latest',
        slug: 'crypto',
        koLabel: '미국 암호화폐',
        koDescription:
            '비트코인·이더리움 등 주요 암호화폐 시장 동향을 모았습니다.',
    },
    forex: {
        sentinel: '__NEWS_FOREX__',
        fmpEndpoint: 'news/forex-latest',
        slug: 'forex',
        koLabel: '미국 외환',
        koDescription:
            '달러·엔·유로 등 주요 통화 쌍의 외환 시장 소식을 모았습니다.',
    },
    articles: {
        sentinel: '__NEWS_ARTICLES__',
        fmpEndpoint: 'fmp-articles',
        slug: 'articles',
        koLabel: '미국 마켓 아티클',
        koDescription:
            'FMP 리서치팀이 작성한 심층 마켓 분석 아티클을 모았습니다.',
    },
};

/** Ordered list of all news category slugs — single source for tab order + SSG params. */
export const NEWS_CATEGORY_SLUGS: readonly NewsFeedCategory[] = Object.freeze(
    Object.keys(CATEGORY_CONFIG) as NewsFeedCategory[]
);

const VALID_SLUGS: ReadonlySet<string> = new Set(Object.keys(CATEGORY_CONFIG));

/** Narrow an arbitrary route param to a NewsFeedCategory, or null if invalid. */
export function categoryFromSlug(slug: string): NewsFeedCategory | null {
    // safe: VALID_SLUGS is Object.keys(CATEGORY_CONFIG), so has(slug) proves slug ∈ NewsFeedCategory
    return VALID_SLUGS.has(slug) ? (slug as NewsFeedCategory) : null;
}
