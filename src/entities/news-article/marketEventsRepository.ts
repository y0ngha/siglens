import 'server-only';

import { and, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import type {
    MarketEvent,
    NewsCategory,
    NewsImpact,
    NewsSentiment,
} from '@y0ngha/siglens-core';
import { NEON_TRANSIENT_RETRY } from '@/shared/db/isNeonTransientError';
import { news } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';

/**
 * 프롬프트에 실을 수 있는 영향도.
 *
 * core의 `selectMarketEvents`가 같은 기준으로 한 번 더 거르지만, 여기서 먼저
 * 좁히는 편이 싸다 — 운영 데이터에서 `negligible`이 60.8%, `low`가 13.5%라
 * 읽어 오지 않는 것만으로 대부분이 빠진다.
 */
const QUALIFYING_IMPACTS: NewsImpact[] = ['high', 'medium'];

/**
 * `category` / `sentiment` / `impact`의 허용 값 집합.
 *
 * `typeof === 'string'`만으로는 부족하다. 이 컬럼들은 몇 달 전 파이프라인이 쓴
 * 값일 수 있고, core 유니온에 없는 문자열이 들어 있으면 캐스트로는 걸러지지
 * 않은 채 **프롬프트에 사실처럼 주입된다.** `analysisHistoryRepository`의
 * `isTrend` / `isRiskLevel`이 같은 이유로 존재한다.
 */
const CATEGORIES: ReadonlySet<string> = new Set<NewsCategory>([
    'earnings',
    'm_and_a',
    'guidance',
    'regulation',
    'macro',
    'product',
    'other',
]);
const SENTIMENTS: ReadonlySet<string> = new Set<NewsSentiment>([
    'bullish',
    'neutral',
    'bearish',
]);
const IMPACTS: ReadonlySet<string> = new Set<NewsImpact>([
    'high',
    'medium',
    'low',
    'negligible',
]);

const isCategory = (value: unknown): value is NewsCategory =>
    typeof value === 'string' && CATEGORIES.has(value);
const isSentiment = (value: unknown): value is NewsSentiment =>
    typeof value === 'string' && SENTIMENTS.has(value);
const isImpact = (value: unknown): value is NewsImpact =>
    typeof value === 'string' && IMPACTS.has(value);

/** {@link findMarketEventsForPrompt} 입력. */
export interface FindMarketEventsInput {
    symbol: string;
    /** 조회 하한(포함). */
    from: Date;
    /** 조회 상한(포함). */
    to: Date;
}

/**
 * 봉 구간에 발행된 고영향 뉴스를 core의 `MarketEvent`로 투영해 읽는다.
 *
 * **본문·제목을 읽지 않는다.** 프롬프트에 실리는 것은 분류뿐이고 기사 텍스트는
 * news / overall 축의 몫이다. 컬럼을 명시적으로 나열하는 것도 그래서다 —
 * `SELECT *`면 `body_en` / `summary_ko`가 딸려 와 요청마다 수십 KB를 낭비한다.
 *
 * **best-effort다.** 뉴스를 못 읽는다고 분석이 실패하면 안 되므로 모든 에러를
 * 흡수하고 빈 배열을 돌려준다 — 이벤트가 없으면 core가 섹션을 생략하고 캐시
 * 키도 이 기능 도입 전과 같아진다(`findRecentForPrompt`와 같은 계약).
 *
 * 인덱스: `news_symbol_published_at_idx`.
 */
export async function findMarketEventsForPrompt(
    db: SiglensDatabase,
    input: FindMarketEventsInput
): Promise<MarketEvent[]> {
    try {
        const rows = await withRetry(
            () =>
                db
                    .select({
                        publishedAt: news.publishedAt,
                        category: news.category,
                        sentiment: news.sentiment,
                        impact: news.priceImpact,
                    })
                    .from(news)
                    .where(
                        and(
                            eq(news.symbol, input.symbol),
                            gte(news.publishedAt, input.from),
                            lte(news.publishedAt, input.to),
                            inArray(news.priceImpact, QUALIFYING_IMPACTS)
                        )
                    )
                    .orderBy(desc(news.publishedAt)),
            NEON_TRANSIENT_RETRY
        );

        return rows.flatMap(row =>
            isCategory(row.category) &&
            isSentiment(row.sentiment) &&
            isImpact(row.impact)
                ? [
                      {
                          publishedAt: row.publishedAt,
                          category: row.category,
                          sentiment: row.sentiment,
                          impact: row.impact,
                      },
                  ]
                : []
        );
    } catch (err) {
        console.error('[marketEventsRepository] read failed:', err);
        return [];
    }
}
