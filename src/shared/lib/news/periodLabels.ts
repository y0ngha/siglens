/**
 * `shared.lib.newsPeriod` 메시지 **키**. 표시 문자열이 아니다 —
 * 예전엔 한국어 리터럴이라 `/en/news`가 영어 목록 위에 `최근 6개월`을 렌더했다.
 */
/** News list period (must match NEWS_LOOKBACK_MS = 180 days). */
export const NEWS_LIST_PERIOD_KEY = 'last6Months';

/** AI aggregate analysis period (must match NEWS_ANALYSIS_LOOKBACK_MS = 30 days). */
export const NEWS_ANALYSIS_PERIOD_KEY = 'last30Days';
