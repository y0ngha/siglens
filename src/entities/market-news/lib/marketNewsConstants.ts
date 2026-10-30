import { MS_PER_DAY } from '@/shared/config/time';
import type { ModelId } from '@y0ngha/siglens-core';

/** 카테고리 피드의 표시 lookback 창(일). 시장 뉴스는 빨리 바뀌므로 ms 계산과 UI 문구가 이 값 하나를 쓴다. */
export const MARKET_NEWS_LOOKBACK_DAYS = 7;

/**
 * 카테고리 피드의 표시 lookback 창(ms). {@link MARKET_NEWS_LOOKBACK_DAYS}에서 파생한다.
 * 시장 뉴스는 빨리 바뀌므로 {@link MARKET_NEWS_LOOKBACK_DAYS}일이면 다이제스트 프롬프트를
 * 부풀리는 낡은 기사를 쌓지 않고 관련 맥락을 담는다.
 */
export const MARKET_NEWS_LOOKBACK_MS = MARKET_NEWS_LOOKBACK_DAYS * MS_PER_DAY;

/** FMP 카테고리 피드 한 번에 받는 기사 수. */
export const FMP_NEWS_FETCH_LIMIT = 50;

/**
 * 공개 카테고리 다이제스트의 서버 고정 모델. BYOK가 없다 — 다이제스트는 게이트가 없고
 * 공용 모델 하나를 쓴다. `'deepseek-v4.1-flash'`는 유효한 {@link ModelId} 멤버다
 * (설치된 `@y0ngha/siglens-core`의 `TierModel` union으로 확인).
 *
 * ⚠️ DeepSeek 분석 어댑터는 `responseSchema`를 무시하고 대신
 * `response_format: { type: 'json_object' }`를 보낸다(siglens-core의
 * `infrastructure/ai/providers/deepseek.ts`). 그래서 다이제스트의 필드 계약은 프롬프트 +
 * `normalize*` 후처리만으로 지켜진다 — 이 경로에서 스키마 강제는 작동하지 않는다.
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

/** 시장 뉴스 센티널 버킷의 ISR 캐시 태그 접두사. 센티널과 `${prefix}:${sentinel}`로 합쳐 쓴다. */
export const MARKET_NEWS_CACHE_TAG_PREFIX = 'market-news';

/**
 * 카드별 분석의 동시 LLM 제출 상한.
 *
 * 50건 × 5개 카테고리를 `Promise.allSettled`로 제한 없이 돌리면 LLM 요청 250건이 한꺼번에
 * 몰려 provider에 stampede가 난다. 이 상한이 처리량을 누르면서도 일반적인 카테고리
 * 크기(10–20건)에서는 지연을 낮게 유지한다.
 */
export const LLM_PARALLEL_LIMIT = 8;
