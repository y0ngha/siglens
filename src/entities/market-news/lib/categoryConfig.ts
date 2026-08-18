import type { NewsFeedCategory } from '@y0ngha/siglens-core';
import type { NavRegionId } from '@/shared/config/assetClassNav';

/**
 * 뉴스 피드 카테고리 식별자 — core의 `NewsFeedCategory`에 siglens 전용 `'kr'`을 더한 것.
 *
 * **왜 core union을 그대로 쓰지 않는가**: 한국 시장 뉴스는 FMP가 아니라 네이버에서
 * 오고, core는 뉴스 *소스*를 모른다(피드 카테고리 이름만 안다). core union을
 * 넓히려면 core 릴리스가 필요한데, 이 카테고리는 core의 어떤 계산에도 들어가지
 * 않는다 — 유일한 접점인 `runMarketNewsDigest({ category })`에서 그 값은 Redis
 * 캐시 키 스코핑에만 쓰이고 프롬프트는 `categoryLabel`만 본다
 * (core `buildMarketNewsDigestPrompt` 확인). 그래서 소비자 쪽에서 넓힌다.
 */
export type NewsFeedCategoryId = NewsFeedCategory | 'kr';

/** 피드를 어느 소스에서 가져오는지. 클라이언트 라우팅 키. */
export type NewsFeedSource = 'fmp' | 'naver';

export interface CategoryConfig {
    /** DB bucket symbol — never shown in a URL. */
    sentinel: string;
    /**
     * FMP `/stable/<path>` for this category's market-wide feed (confirmed in Phase 0).
     * `source: 'naver'`인 카테고리는 빈 문자열이다 — 대신 `naverQueries`를 쓴다.
     */
    fmpEndpoint: string;
    /**
     * 네이버 검색어 목록(`source: 'naver'` 전용). 결과는 URL 기준으로 합쳐진다.
     *
     * 여러 개인 이유: 단일 질의로는 시장 전반을 못 덮는다 — `코스피`만 쓰면 코스닥
     * 종목 뉴스가 통째로 빠진다. 질의당 1회 호출이므로 개수는 그대로 API 비용이다.
     */
    naverQueries: readonly string[];
    /** 어느 소스에서 오는가. `getMarketNewsClient`가 이 값으로 어댑터를 고른다. */
    source: NewsFeedSource;
    /** URL slug at /news/<slug>. */
    slug: NewsFeedCategoryId;
    /**
     * 어느 지역(자산군)에 속하는가. `/news` 허브의 그룹핑과 카테고리 페이지의
     * 지역 탭 활성 표시가 이 값을 읽는다. 카테고리 탭도 같은 지역끼리만 묶는다 —
     * `미국 주식` 옆에 `한국 증시` 탭이 붙으면 지역을 나눈 의미가 없어진다.
     */
    region: NavRegionId;
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

export const CATEGORY_CONFIG: Record<NewsFeedCategoryId, CategoryConfig> = {
    general: {
        sentinel: '__NEWS_GENERAL__',
        fmpEndpoint: 'news/general-latest',
        naverQueries: [],
        source: 'fmp',
        slug: 'general',
        region: 'us',
        koLabel: '미국 일반 시장',
        koDescription: '미국 전반적인 시장 흐름과 거시 경제 소식을 모았습니다.',
    },
    stock: {
        sentinel: '__NEWS_STOCK__',
        fmpEndpoint: 'news/stock-latest',
        naverQueries: [],
        source: 'fmp',
        slug: 'stock',
        region: 'us',
        koLabel: '미국 주식',
        koDescription:
            '미국 주식 시장의 주요 종목 뉴스와 실적 이슈를 모았습니다.',
    },
    crypto: {
        sentinel: '__NEWS_CRYPTO__',
        fmpEndpoint: 'news/crypto-latest',
        naverQueries: [],
        source: 'fmp',
        slug: 'crypto',
        region: 'crypto',
        koLabel: '암호화폐',
        koDescription:
            '비트코인·이더리움 등 주요 암호화폐 시장 동향을 모았습니다.',
    },
    forex: {
        sentinel: '__NEWS_FOREX__',
        fmpEndpoint: 'news/forex-latest',
        naverQueries: [],
        source: 'fmp',
        slug: 'forex',
        region: 'us',
        koLabel: '미국 외환',
        koDescription:
            '달러·엔·유로 등 주요 통화 쌍의 외환 시장 소식을 모았습니다.',
    },
    articles: {
        sentinel: '__NEWS_ARTICLES__',
        fmpEndpoint: 'fmp-articles',
        naverQueries: [],
        source: 'fmp',
        slug: 'articles',
        region: 'us',
        koLabel: '미국 마켓 아티클',
        koDescription:
            'FMP 리서치팀이 작성한 심층 마켓 분석 아티클을 모았습니다.',
    },
    kr: {
        sentinel: '__NEWS_KR__',
        fmpEndpoint: '',
        // 코스피·코스닥을 각각 덮고, 지수 이름이 안 들어간 거시·수급 기사를 위해
        // `국내 증시`를 더한다. 3회 호출은 refresh TTL(30분) 주기당 비용이다.
        naverQueries: ['코스피', '코스닥', '국내 증시'],
        source: 'naver',
        slug: 'kr',
        region: 'kr',
        koLabel: '한국 증시',
        koDescription:
            '코스피·코스닥 등 국내 증시 주요 뉴스를 네이버 뉴스에서 모았습니다.',
    },
};

/** Ordered list of all news category slugs — single source for tab order + SSG params. */
export const NEWS_CATEGORY_SLUGS: readonly NewsFeedCategoryId[] = Object.freeze(
    // safe: CATEGORY_CONFIG is Record<NewsFeedCategoryId, CategoryConfig>, so Object.keys is exactly the union members — TS just widens to string[].
    Object.keys(CATEGORY_CONFIG) as NewsFeedCategoryId[]
);

const VALID_SLUGS: ReadonlySet<string> = new Set(Object.keys(CATEGORY_CONFIG));

/** Narrow an arbitrary route param to a NewsFeedCategoryId, or null if invalid. */
export function categoryFromSlug(slug: string): NewsFeedCategoryId | null {
    // safe: VALID_SLUGS is Object.keys(CATEGORY_CONFIG), so has(slug) proves slug ∈ NewsFeedCategoryId
    return VALID_SLUGS.has(slug) ? (slug as NewsFeedCategoryId) : null;
}

/** 한 지역에 속한 카테고리들, 선언 순서 유지. `/news` 허브와 카테고리 탭이 쓴다. */
export function categoriesInRegion(
    region: NavRegionId
): readonly NewsFeedCategoryId[] {
    return NEWS_CATEGORY_SLUGS.filter(
        cat => CATEGORY_CONFIG[cat].region === region
    );
}
