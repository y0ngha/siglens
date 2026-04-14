import type { Timeframe } from '@/domain/types';

export const DEFAULT_TIMEFRAME: Timeframe = '1Day';

export const TIMEFRAMES: readonly Timeframe[] = [
    '5Min',
    '15Min',
    '30Min',
    '1Hour',
    '4Hour',
    '1Day',
];

export function isValidTimeframe(
    value: string | undefined | null
): value is Timeframe {
    if (!value) return false;
    return (TIMEFRAMES as readonly string[]).includes(value);
}

/**
 * TIMEFRAME_BARS_LIMIT: 타임프레임별 조회 바 수.
 * - '5Min':  288 = 약 3.7거래일치 (6.5시간 × 12봉/시간 = 78봉/일, 288 / 78 ≈ 3.7일)
 * - '15Min': 200 = 약 7.7거래일치 (6.5시간 × 4봉/시간 = 26봉/일, 200 / 26 ≈ 7.7일)
 * - '30Min': 200 = 약 15거래일치 (6.5시간 × 2봉/시간 = 13봉/일, 200 / 13 ≈ 15.4일)
 * - '1Hour': 200 = 약 5거래주치 (중기 추세 확인)
 * - '4Hour': 200 = 약 6개월치 4시간봉 (하루 1.625봉 × 200 ≈ 123 거래일)
 * - '1Day':  500 = 약 2년치 거래일 (장기 추세 확인)
 */
export const TIMEFRAME_BARS_LIMIT: Record<Timeframe, number> = {
    '5Min': 288,
    '15Min': 200,
    '30Min': 200,
    '1Hour': 200,
    '4Hour': 200,
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
 * - '5Min':  10일  → 288봉 ≈ 3.7 거래일, 넉넉히 10일
 * - '15Min': 20일  → 200봉 ≈ 7.7 거래일, 넉넉히 20일
 * - '30Min': 30일  → 200봉 ≈ 15 거래일, 넉넉히 30일
 * - '1Hour': 60일  → 200봉 ≈ 31 거래일, 넉넉히 60일
 * - '4Hour': 200일 → 200봉 ≈ 123 거래일, 넉넉히 200일
 * - '1Day':  730일 → 500봉 ≈ 2년, 넉넉히 730일
 */
export const TIMEFRAME_LOOKBACK_DAYS: Record<Timeframe, number> = {
    '5Min': 10,
    '15Min': 20,
    '30Min': 30,
    '1Hour': 60,
    '4Hour': 200,
    '1Day': 730,
};
