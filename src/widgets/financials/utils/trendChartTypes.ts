/**
 * 추세 차트의 입력 타입 — 섹션이 시리즈를 만들고 차트 하위 컴포넌트가 읽는다.
 */

/** 시리즈 색 종류. 상승(bullish)·하락(bearish)·중립(neutral)의 의미 색이다. */
export type SeriesColor = 'bullish' | 'bearish' | 'neutral';

/** 추세 차트의 한 시리즈. */
export interface TrendSeries {
    labelKo: string;
    /**
     * `periods`에 정렬된 값. 과거→최신(좌→우) 순서이며 `null`은 그 기간의 데이터 없음.
     */
    values: (number | null)[];
    color?: SeriesColor;
}
