/** 로컬 극값 판별 시 좌우로 볼 봉 수 */
export const PATTERN_PEAK_LOOKBACK = 3;

/** 헤드앤숄더·역헤드앤숄더 감지 최소 봉 수 */
export const PATTERN_MIN_BARS_HEAD_SHOULDERS = 30;

/** 이중천장·이중바닥 감지 최소 봉 수 */
export const PATTERN_MIN_BARS_DOUBLE = 20;

/** 쐐기형 감지에 사용하는 최근 봉 수 */
export const PATTERN_BARS_WEDGE = 20;

/** 헤드앤숄더 어깨 높이 허용 오차 (5 %) */
export const PATTERN_SHOULDER_TOLERANCE = 0.05;

/** 헤드앤숄더 넥라인 일치 허용 오차 (5 %) */
export const PATTERN_NECKLINE_TOLERANCE = 0.05;

/** 이중천장·이중바닥 두 고점·저점 가격 허용 오차 (3 %) */
export const PATTERN_DOUBLE_PRICE_TOLERANCE = 0.03;

// ─── 캔들스틱 임계값 ──────────────────────────────────────────────────────────

/** 도지 판별 봉체 비율 상한 (봉체가 range의 10 % 이하) */
export const CANDLE_DOJI_BODY_RATIO = 0.1;

/** 반전형 캔들(슈팅스타·망치) 봉체 비율 상한 (30 %) */
export const CANDLE_REVERSAL_MAX_BODY = 0.3;

/** 슈팅스타 최소 윗 꼬리 비율 (range 의 60 % 이상) */
export const CANDLE_SHOOTING_STAR_UPPER_SHADOW_MIN = 0.6;

/** 망치 최소 아랫 꼬리 비율 (range 의 60 % 이상) */
export const CANDLE_HAMMER_LOWER_SHADOW_MIN = 0.6;

// ─── confidence 가중치 ────────────────────────────────────────────────────────

/** 이중천장·이중바닥 — 가격 유사도 가중치 */
export const PATTERN_DOUBLE_PRICE_WEIGHT = 0.6;

/** 이중천장·이중바닥 — 거래량 다이버전스 가중치 */
export const PATTERN_DOUBLE_VOLUME_WEIGHT = 0.25;

/** 이중천장·이중바닥 — 캔들 반전 확인 가중치 */
export const PATTERN_DOUBLE_CANDLE_WEIGHT = 0.15;

/** 헤드앤숄더 — 어깨 대칭 가중치 */
export const PATTERN_HS_SHOULDER_WEIGHT = 0.4;

/** 헤드앤숄더 — 넥라인 일관성 가중치 */
export const PATTERN_HS_NECKLINE_WEIGHT = 0.3;

/** 헤드앤숄더 — 거래량 패턴 가중치 */
export const PATTERN_HS_VOLUME_WEIGHT = 0.3;

/** 쐐기형 — 수렴 강도 가중치 */
export const PATTERN_WEDGE_CONVERGENCE_WEIGHT = 0.7;

/** 쐐기형 — 거래량 감소 가중치 */
export const PATTERN_WEDGE_VOLUME_WEIGHT = 0.3;
