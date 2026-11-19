/**
 * 시그렌즈 위젯(재무 추세 차트·재무제표 표)에 그대로 넘길 수 있는 모양 — 위젯 간 import가 금지라(`noCrossWidgetImports`)
 * 위젯의 타입을 가져오지 않고 같은 모양을 구조적으로 다시 적는다. 조립하는 app 레이어에서 타입이 맞는지 컴파일러가 본다.
 */

/** 추세 차트의 한 시리즈 — 값은 `columns`와 같은 순서(과거→최신)이다. */
export interface ChatTrendSeries {
    labelKo: string;
    values: (number | null)[];
    color: 'bullish' | 'bearish' | 'neutral';
}

/** 재무제표 표의 한 행. */
export interface ChatStatementRow {
    labelKo: string;
    values: (number | null)[];
    format: 'usd' | 'perShare';
    /** `false`면 부호와 무관하게 중립색 — 절대 규모가 좋고 나쁨이 아닌 행. */
    colorize?: boolean;
}

/** 추세 차트 + 표로 그리는 블록(실적·배당)의 화면 모델. */
export interface ChatTrendTableModel {
    title: string;
    ariaLabel: string;
    asOfText: string;
    currency: string;
    columns: string[];
    series: ChatTrendSeries[];
    rows: ChatStatementRow[];
}
