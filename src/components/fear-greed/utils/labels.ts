import type { FearGreedFactorKey } from '@y0ngha/siglens-core';

/** Factor key → 한글 표시 라벨. UI는 이 객체로 일관 표시한다. */
export const FACTOR_LABEL: Record<FearGreedFactorKey, string> = {
    volume_z: '거래량 z (방향성)',
    buysell_imbalance: 'Buy/Sell 불균형',
    poc_distance: 'POC 거리(60bar)',
    ma200_distance: 'MA200 거리',
    range_position: '52w 위치',
};

/** Raw value 표시 포맷터 — UI는 이 함수로 raw 값을 출력한다. */
export function formatFactorRaw(
    key: FearGreedFactorKey,
    rawValue: number
): string {
    switch (key) {
        case 'volume_z':
            return rawValue.toFixed(2);
        case 'buysell_imbalance':
            return `${(rawValue * 100).toFixed(1)}%`;
        // poc_distance와 ma200_distance: 가격 거리 (%) — 동일 정밀도(소수 둘째 자리)
        case 'poc_distance':
        case 'ma200_distance':
            return `${(rawValue * 100).toFixed(2)}%`;
        case 'range_position':
            return `${(rawValue * 100).toFixed(1)}%`;
    }
}
