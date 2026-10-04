import 'server-only';
import type {
    MacroBriefingResponse,
    MarketBriefingResponse,
    NewsAnalysisResponse,
} from '@y0ngha/siglens-core';
import { peekBriefingStatic } from '@/entities/market-summary/api/briefingStaticCache';
import { getMarketSummaryStatic } from '@/entities/market-summary/api/marketSummaryStaticCache';
import { getEconomySnapshotStatic } from '@/entities/economy/api/economySnapshotStaticCache';
import { peekMacroBriefingStatic } from '@/entities/economy/api/macroBriefingStaticCache';
import { peekMarketNewsDigestStatic } from '@/entities/market-news/api/marketNewsDigestStaticCache';
import {
    CATEGORY_CONFIG,
    type NewsFeedCategoryId,
} from '@/entities/market-news/lib/categoryConfig';
import {
    economyHubPath,
    marketHubPath,
    newsHubPath,
    RSS_ECONOMY_SURFACE,
    rssMarketSurface,
    rssNewsSurface,
} from '@/entities/rss-feed/model';
import {
    KR_DASHBOARD_SCOPE,
    US_DASHBOARD_SCOPE,
    type DashboardScope,
} from '@/shared/config/dashboardScope';
import { ISO_DATE_HOUR_SLICE_END } from '@/shared/config/time';
import { DEFAULT_LOCALE } from '@/shared/i18n/locales';

/** 소스 하나가 읽어 온 본문과, 그 본문에서 설명으로 쓸 산문 필드. */
export interface RssSourceRead {
    /** 허브 페이지가 읽는 것과 같은 정적 reader의 결과 — 스탬프 해시와 대조한다. */
    readonly body: unknown;
    /** 설명으로 쓸 본문의 주 산문 필드(마크다운 포함 원문). */
    readonly prose: string;
}

/**
 * RSS 항목 하나가 나오는 표면.
 *
 * `read`는 **허브 페이지가 쓰는 정적 reader를 그대로** 부른다 — 피드에 페이지가 보여 주지
 * 않는 문장이 나오면 안 된다. 본문이 없으면(캐시 미스) `null`이다.
 */
export interface RssSource {
    /** 스탬프 표면(`rssMarketSurface` 등) — 크론이 쓰는 이름과 같아야 한다. */
    readonly surface: string;
    /** 공개 허브 경로. 정적 sitemap 대조에 쓴다. */
    readonly path: string | null;
    /** 항목 제목. 한국어 전용 피드라 문구를 여기 둔다(API 라우트는 i18n 추출 밖이다). */
    readonly title: string;
    readonly read: () => Promise<RssSourceRead | null>;
}

/** 시간 단위 키 — 페이지가 `unstable_cache` 키 입도로 쓰는 값과 같은 계산이다. */
function currentDateHour(): string {
    return new Date().toISOString().slice(0, ISO_DATE_HOUR_SLICE_END);
}

function marketSource(scope: DashboardScope, title: string): RssSource {
    return {
        surface: rssMarketSurface(scope.id),
        path: marketHubPath(scope.id),
        title,
        read: async () => {
            const summary = await getMarketSummaryStatic(scope);
            const body: MarketBriefingResponse | null =
                await peekBriefingStatic(summary, currentDateHour(), scope);
            if (body === null) return null;
            // 시장 브리핑의 한 문장 요약. 소제목·테마 배열은 설명에 섞지 않는다.
            return { body, prose: body.summary };
        },
    };
}

const macroSource: RssSource = {
    surface: RSS_ECONOMY_SURFACE,
    path: economyHubPath('us'),
    title: '거시 경제 브리핑',
    read: async () => {
        const snapshot = await getEconomySnapshotStatic();
        const body: MacroBriefingResponse | null =
            await peekMacroBriefingStatic(snapshot, currentDateHour());
        if (body === null) return null;
        return { body, prose: body.summary };
    },
};

function newsSource(category: NewsFeedCategoryId): RssSource {
    const config = CATEGORY_CONFIG[category];
    return {
        surface: rssNewsSurface(category),
        path: newsHubPath(category),
        title: `${config.koLabel} 뉴스 요약`,
        read: async () => {
            const body: NewsAnalysisResponse | null =
                await peekMarketNewsDigestStatic(category, DEFAULT_LOCALE);
            if (body === null) return null;
            // 다이제스트의 도입 문단. 이벤트 목록은 설명에 섞지 않는다.
            return { body, prose: body.currentDriverKo };
        },
    };
}

/**
 * 피드에 오를 수 있는 표면 전부. 순서는 의미가 없다(빌더가 최신순으로 정렬한다).
 *
 * 시장 브리핑은 화면이 있는 두 시장만이다 — 크론의 `marketBriefingTargets`가 도는
 * `hasHubPage` scope와 같다. 시장이 늘면 여기에도 한 줄을 더한다.
 */
export function rssSources(): readonly RssSource[] {
    return [
        marketSource(US_DASHBOARD_SCOPE, '미국 시장 브리핑'),
        marketSource(KR_DASHBOARD_SCOPE, '한국 시장 브리핑'),
        macroSource,
        // safe: CATEGORY_CONFIG is Record<NewsFeedCategoryId, CategoryConfig>, so
        // Object.keys is exactly the union members — TS just widens to string[].
        ...(Object.keys(CATEGORY_CONFIG) as NewsFeedCategoryId[]).map(
            newsSource
        ),
    ];
}
