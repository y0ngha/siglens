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
    '1Min': 200,
    '5Min': 288,
    '15Min': 200,
    '1Hour': 200,
    '1Day': 500,
};

/**
 * DEFAULT_BARS_LIMIT: 1Day 기준으로 약 2년치 거래일(500)에 해당하는 기본 조회 수.
 * bars route handler와 symbol page 서버 컴포넌트에서 공유한다.
 */
export const DEFAULT_BARS_LIMIT = TIMEFRAME_BARS_LIMIT['1Day'];
