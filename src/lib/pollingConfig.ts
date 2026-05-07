// 분석 잡 폴링 간격 모음 — 분석 종류별로 워커 작업 시간/캐시 히트 빈도가 달라 의도적으로 다른 값을 사용한다.

/** Fundamental + News 페이지 (LLM 호출 1회로 짧음). */
export const FUNDAMENTAL_NEWS_POLL_INTERVAL_MS = 2500;

/** 차트 페이지 augment + Overall 의존성 폴링 — 캐시 적중률이 높아 느린 간격으로 충분. */
export const AUGMENT_AND_OVERALL_POLL_INTERVAL_MS = 3000;

/** 차트 페이지 메인 분석 — 워커가 다단계 작업을 수행해 길게 잡는다. */
export const CHART_ANALYSIS_POLL_INTERVAL_MS = 10000;
