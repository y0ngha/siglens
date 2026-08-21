import type { MarketFearGreedComparisonKey } from '@/entities/market-fear-greed';

/**
 * Lookback → `shared.ui.period` 메시지 키. **표시 문자열이 아니다.**
 *
 * `shared`는 `entities`를 import할 수 없어(FSD 의존 방향) 나머지 Fear & Greed
 * 라벨과 달리 이 표만 위젯 쪽에 둔다 — shared에 두면 키 유니온을 한 벌 더
 * 적어야 하고, 그 사본이 entity 타입과 조용히 어긋날 수 있다.
 *
 * 컴포넌트 파일이 아니라 여기 있는 이유: 컴포넌트와 상수를 한 파일에서
 * 내보내면 Fast Refresh가 그 모듈을 컴포넌트 모듈로 보지 못해 편집할 때마다
 * 전체 리마운트가 된다(react-doctor/only-export-components).
 */
export const MARKET_COMPARISON_LABEL_KEY: Record<
    MarketFearGreedComparisonKey,
    string
> = {
    now: 'now',
    '1w': 'weekAgo',
    '1m': 'monthAgo',
    '1y': 'yearAgo',
};
