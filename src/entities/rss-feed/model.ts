import { regionHrefOf, type NavRegionId } from '@/shared/config/assetClassNav';
import {
    CATEGORY_CONFIG,
    type NewsFeedCategoryId,
} from '@/entities/market-news/lib/categoryConfig';

export interface RssItem {
    readonly title: string;
    /** 절대 허브 URL. */
    readonly link: string;
    /** `${link}#${본문 해시 앞 12자}` — `isPermaLink="false"`로 나간다. */
    readonly guid: string;
    /** 이 본문이 처음 확인된 시각. */
    readonly pubDate: Date;
    /** 평문. 호출부가 마크다운을 떼고 500 code point 이내 문장 경계로 줄여 넘긴다. */
    readonly description: string;
    /**
     * 같은 본문 전체의 문단(평문). 있으면 `content:encoded`에 `<p>` 문단으로 싣는다 — 리더가
     * 요약(`description`) 대신 전문을 보여 줄 수 있다. 호출부가 마크다운을 뗀 뒤 넘긴다.
     */
    readonly paragraphs?: readonly string[];
}

export interface RssChannel {
    readonly title: string;
    readonly link: string;
    readonly description: string;
    readonly language: string;
    /** 이 피드 자신의 절대 URL(`atom:link rel="self"`). */
    readonly selfUrl: string;
    /** 순서 무관 — 빌더가 최신순으로 정렬한다. */
    readonly items: readonly RssItem[];
}

/**
 * 허브 본문 스탬프의 표면 이름(`hubContentStamp`)을 **한 곳에서** 정한다.
 *
 * 크론(기록)과 RSS 라우트(읽기)가 같은 문자열을 써야 스탬프가 맞물린다 — 각자 철자하면
 * 한쪽만 바뀌는 순간 모든 항목이 조용히 사라진다(스탬프 없음 = 항목 없음).
 * 페이지 하나당 표면 하나다.
 */
export function rssMarketSurface(scopeId: string): string {
    return `rss:market:${scopeId}`;
}

export const RSS_ECONOMY_SURFACE = 'rss:economy';

export function rssNewsSurface(category: string): string {
    return `rss:news:${category}`;
}

/**
 * 허브 공개 경로의 **유일한 도출 지점**. 크론(`hubs.ts`, IndexNow 제출용 URL)과 RSS(`sources.ts`,
 * 항목 링크)가 같은 함수를 쓴다 — 따로 도출하면 한쪽만 바뀔 때 IndexNow가 알린 URL과 피드가
 * 가리키는 URL이 갈라지고, 둘 다 정적 sitemap 대조에서 조용히 탈락한다.
 *
 * 경로는 내비 단일 소스(`assetClassNav`)·카테고리 설정에서 파생하므로 sitemap 빌더와도 같다.
 * 화면이 없는 지역은 `null`이다.
 */
export function marketHubPath(region: NavRegionId): string | null {
    return regionHrefOf('market', region);
}

export function economyHubPath(region: NavRegionId): string | null {
    return regionHrefOf('economy', region);
}

export function newsHubPath(category: NewsFeedCategoryId): string {
    return `/news/${CATEGORY_CONFIG[category].slug}`;
}
