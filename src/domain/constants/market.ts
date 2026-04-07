import type { Timeframe } from '@/domain/types';

export const DEFAULT_TIMEFRAME: Timeframe = '1Day';

/**
 * TIMEFRAME_BARS_LIMIT: 타임프레임별 조회 바 수.
 * - '5Min': 288 = 1거래일(6.5시간 × 60분 / 5분) × 1일, 하루 전체 분봉 커버
 * - '1Min': 200 = 약 3시간 20분치 분봉 (초단기 분석에 충분한 양)
 * - '15Min': 200 = 약 2.5거래일치 (단기 추세 확인)
 * - '1Hour': 200 = 약 5거래주치 (중기 추세 확인)
 * - '1Day': 500 = 약 2년치 거래일 (장기 추세 확인)
 */
export const TIMEFRAME_BARS_LIMIT: Record<Timeframe, number> = {
    // TODO: 비용 문제로 인해 우선 1Day만 허용; 미사용이어도 이를 정리하지 않고 넘어간다. 나중에 사용할 예정이다.
    // '1Min': 200,
    // '5Min': 288,
    // '15Min': 200,
    // '1Hour': 200,
    '1Day': 500,
};

/**
 * DEFAULT_BARS_LIMIT: 1Day 기준으로 약 2년치 거래일(500)에 해당하는 기본 조회 수.
 * bars route handler와 symbol page 서버 컴포넌트에서 공유한다.
 */
export const DEFAULT_BARS_LIMIT = TIMEFRAME_BARS_LIMIT[DEFAULT_TIMEFRAME];

/**
 * TIMEFRAME_LOOKBACK_DAYS: 타임프레임별 조회 시작일 기준(캘린더 일수).
 * 주말·공휴일을 포함해도 limit만큼의 거래 바가 확보되도록 여유분을 포함한다.
 * - '1Min':   5일  → 200봉 ≈ 0.5 거래일, 넉넉히 5일
 * - '5Min':  10일  → 288봉 ≈ 3.7 거래일, 넉넉히 10일
 * - '15Min': 20일  → 200봉 ≈ 7.7 거래일, 넉넉히 20일
 * - '1Hour': 60일  → 200봉 ≈ 31 거래일, 넉넉히 60일
 * - '1Day':  730일 → 500봉 ≈ 2년, 넉넉히 730일
 */
export const TIMEFRAME_LOOKBACK_DAYS: Record<Timeframe, number> = {
    // TODO: 비용 문제로 인해 우선 1Day만 허용; 미사용이어도 이를 정리하지 않고 넘어간다. 나중에 사용할 예정이다.
    // '1Min': 5,
    // '5Min': 10,
    // '15Min': 20,
    // '1Hour': 60,
    '1Day': 730,
};
