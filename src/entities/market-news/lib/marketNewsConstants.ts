import { MS_PER_DAY } from '@/shared/config/time';
import type { ModelId } from '@y0ngha/siglens-core';

/** Display lookback window in days for category feeds (market news churns fast — single source for both ms and UI copy). */
export const MARKET_NEWS_LOOKBACK_DAYS = 7;

/**
 * Display lookback window for category feeds, derived from
 * {@link MARKET_NEWS_LOOKBACK_DAYS}.
 * Market news churns fast — {@link MARKET_NEWS_LOOKBACK_DAYS} days captures
 * relevant context without accumulating stale articles that bloat the digest
 * prompt.
 */
export const MARKET_NEWS_LOOKBACK_MS = MARKET_NEWS_LOOKBACK_DAYS * MS_PER_DAY;

/** Items fetched per category feed from FMP. */
export const FMP_NEWS_FETCH_LIMIT = 50;

/**
 * Fixed server-side model for the public category digest.
 * No BYOK — the digest is gating-free and uses a single shared model.
 * `'deepseek-v4.1-flash'` is a valid {@link ModelId} member (verified against
 * the installed `@y0ngha/siglens-core` `TierModel` union).
 *
 * ⚠️ The DeepSeek analysis adapter ignores `responseSchema` and sends
 * `response_format: { type: 'json_object' }` instead (see
 * `infrastructure/ai/providers/deepseek.ts` in siglens-core), so the digest's
 * field contract is carried by the prompt + `normalize*` post-processing
 * alone — schema enforcement is NOT in play on this path.
 */
export const DEFAULT_DIGEST_MODEL_ID = 'deepseek-v4.1-flash' satisfies ModelId;

/**
 * 카테고리 다이제스트의 추론(thinking) 여부. **캐시 키 성분**이라 생성(액션·허브 프리웜)과
 * 읽기(SSR peek)가 반드시 같은 값을 써야 한다 — 그래서 상수 하나로 둔다. 어긋나면 peek가
 * 아무도 쓰지 않은 키를 읽어 영원히 miss다.
 *
 * 2026-10-01 꺼짐(이전엔 `true`). 자동 실행 AI 중 추론을 켠 곳은 이 다이제스트뿐이었다
 * (브리핑·종목 분석·카드 보강·경제 이벤트 분석·번역·평이화는 전부 off). 켠 근거는
 * "카테고리 피드 수십 건을 하나의 서술로 합성하는 작업이라 추론 이득이 나온다"였지만
 * 실측 비교는 없었고, 추론은 출력 토큰·지연을 키운다. 같은 계열의 시장·거시 브리핑도
 * 여러 입력을 합성하면서 off로 돌고 있어 off로 맞췄다. 값을 바꾸면 전 카테고리 다이제스트가
 * 새 키로 한 번씩 재생성된다.
 */
export const DIGEST_REASONING = false;

/** ISR cache-tag prefix for market-news sentinel buckets. Combined with the sentinel as `${prefix}:${sentinel}`. */
export const MARKET_NEWS_CACHE_TAG_PREFIX = 'market-news';

/**
 * Max concurrent LLM submissions for per-card analysis.
 *
 * Unbounded `Promise.allSettled` over 50 items × 5 categories = 250 concurrent
 * LLM requests stampedes the provider. This cap throttles throughput while
 * still keeping latency low for typical category sizes (10–20 items).
 */
export const LLM_PARALLEL_LIMIT = 8;
