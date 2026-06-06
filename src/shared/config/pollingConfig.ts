// 분석 잡 폴링 간격 모음 — 분석 종류별로 워커 작업 시간/캐시 히트 빈도가 달라 의도적으로 다른 값을 사용한다.
// 폴링마다 서버 액션(함수)을 호출해 Fast Origin Transfer + Function Invocation을 유발하므로,
// 분석이 수십 초 걸리는 작업 특성에 맞춰 간격을 넉넉히 잡아 폴링 횟수(=비용)를 줄인다.
// 트레이드오프: 완료 감지가 간격만큼 늦어질 수 있다(평균 간격/2).

/** Fundamental, News, Options 페이지 분석 폴링 (LLM 호출 1회). */
export const ANALYSIS_POLL_INTERVAL_MS = 10000;

/** 차트 페이지 augment + Overall 의존성 폴링 — 캐시 적중률이 높아 느린 간격으로 충분. */
export const AUGMENT_AND_OVERALL_POLL_INTERVAL_MS = 5000;

/** 차트 페이지 메인 분석 — 워커가 다단계 작업을 수행해 길게 잡는다. */
export const CHART_ANALYSIS_POLL_INTERVAL_MS = 30000;
