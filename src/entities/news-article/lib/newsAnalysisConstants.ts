/**
 * Explicitly disables extended thinking for per-card translation/classification
 * tasks. Deterministic transformations gain no quality benefit from extended
 * thinking while incurring extra latency and cost.
 */
export const DISABLED_THINKING_BUDGET = 0;

/**
 * 동시 `runNewsCardAnalysis` 호출 상한 — `withConcurrencyLimit` 인자.
 *
 * `runNewsCardAnalysis`는 블로킹 LLM 왕복이다(worker 제거 이후). N개를
 * 무제한 병렬 실행하면 2-vCPU 서버에서 커넥션 풀 고갈 / 메모리 압박이 생긴다.
 * 카테고리 피드(50개, LLM_PARALLEL_LIMIT=8)보다 적은 경향이 있는 심볼별
 * 뉴스에서 4로 설정한다 — 처리량과 서버 여유 사이의 균형(경제 캘린더
 * CALENDAR_ANALYSIS_PARALLEL_LIMIT=4와 동일 근거).
 */
export const NEWS_CARD_ANALYSIS_PARALLEL_LIMIT = 4;
