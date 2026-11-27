/*
 * `show_chart`의 출력 계약. 도구 설명(`features/agent-tools/spec/showChart.ts`)이 이 목록·숫자를 그대로 말하고, 이
 * 엔티티의 차트 블록 타입·검증과 도구 실행기가 같은 값을 쓴다. 원래 core가 내보내던 값(같은 이름·같은 값)이다.
 */

/** `show_chart`가 답변 아래 그리는 표시 전용 차트 종류. */
export const AGENT_CHART_KINDS = [
    'compare',
    'financials',
    'options',
    'flows',
    'portfolio',
    'heatmap',
    'dividends',
] as const;
export type AgentChartKind = (typeof AGENT_CHART_KINDS)[number];

/** `compare` 차트가 받는 기간. 생략하면 `6M`이다. */
export const AGENT_CHART_PERIODS = ['1M', '3M', '6M', '1Y'] as const;
export type AgentChartPeriod = (typeof AGENT_CHART_PERIODS)[number];

/** `compare` 차트 하나에 넣는 최소 종목 수. */
export const AGENT_COMPARE_SYMBOLS_MIN = 2;
/** `compare` 차트 하나에 넣는 최대 종목 수 — 더 많으면 채팅 폭에서 선이 읽히지 않는다. */
export const AGENT_COMPARE_SYMBOLS_MAX = 5;
