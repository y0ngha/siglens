export const CHART_COLORS = {
    /*
     * 차트 크롬(배경 / 그리드 / 축 텍스트). **이 3키만 테마에 따라 변한다** —
     * 나머지 90여 키는 지표 고유 색이라 두 테마에서 동일하다. 값은
     * `globals.css`의 secondary-900 / 800·700 사이 / 500과 짝을 이룬다
     * (`DESIGN.md`의 단일 진실 공급원 규약).
     *
     * lightweight-charts는 CSS 변수를 읽지 못해 JS 리터럴이어야 한다. 라이트
     * 테마 대응은 테마 배선 PR에서 `CHART_COLORS_LIGHT` 오버라이드 맵으로
     * 붙인다 — 이 객체의 키 모양은 그대로 두므로 41개 소비처가 무변경이다.
     */
    background: '#09090b',
    grid: '#1f1f26',
    text: '#96979f',

    /* 선만 보이고 채움은 없어야 하는 AreaSeries 전용(볼린저·켈트너·돈치안).
       예전에는 배경색을 채워 "안 보이게" 만들었는데, 그러면 테마가 바뀔 때마다
       채움색도 따라 바꿔야 하고 빠뜨리면 라이트 차트에 검은 블록이 가격을
       덮는다. 진짜 투명이면 배경이 무엇이든 무관해져 테마 대응 대상에서 빠진다. */
    transparentFill: 'rgba(0, 0, 0, 0)',

    // 상승 / 하락 / 중립
    bullish: '#26a69a',
    bearish: '#ef5350',
    neutral: '#94a3b8',

    // 거래량 (50% 투명도)
    volumeBullish: '#26a69a80',
    volumeBearish: '#ef535080',

    // MA / EMA 기간별 컬러 (MA 실선, EMA 점선 공용)
    period5: '#ef4444',
    period10: '#f97316',
    period20: '#eab308',
    period60: '#22c55e',
    period120: '#3b82f6',
    period200: '#a855f7',

    // 볼린저 밴드
    bollingerUpper: '#818cf8',
    bollingerMiddle: '#94a3b8',
    bollingerLower: '#818cf8',
    bollingerBackground: '#818cf820',

    keltnerUpper: '#5eead4',
    keltnerMiddle: '#14b8a6',
    keltnerLower: '#5eead4',
    keltnerBackground: '#5eead420',
    donchianUpper: '#fcd34d',
    donchianMiddle: '#d97706',
    donchianLower: '#fcd34d',
    donchianBackground: '#fcd34d20',

    // MACD
    macdLine: '#3b82f6',
    macdSignal: '#f59e0b',
    macdHistogramBullish: '#26a69a',
    macdHistogramBearish: '#ef5350',

    // RSI
    rsiLine: '#a78bfa',
    rsiOverbought: '#ef535060',
    rsiOversold: '#26a69a60',

    // DMI
    dmiPlus: '#26a69a',
    dmiMinus: '#ef5350',
    dmiAdx: '#f59e0b',

    // Stochastic
    stochasticK: '#f472b6',
    stochasticD: '#38bdf8',
    stochasticOverbought: '#ef535060',
    stochasticOversold: '#26a69a60',

    // Stochastic RSI
    stochRsiK: '#facc15',
    stochRsiD: '#60a5fa',
    stochRsiOverbought: '#ef535060',
    stochRsiOversold: '#26a69a60',

    // CCI
    cciLine: '#fb923c',
    cciOverbought: '#ef535060',
    cciOversold: '#26a69a60',
    cciZero: '#94a3b860',

    // VWAP
    vwap: '#e879f9',

    // Volume Profile
    vpPoc: '#f59e0b',
    vpVah: '#8b5cf6',
    vpVal: '#34d399',

    // 추세선
    trendlineAscending: '#26a69a',
    trendlineDescending: '#ef5350',

    // 지지/저항선
    supportLine: '#26a69a',
    resistanceLine: '#ef5350',

    // Action Recommendation 가격선
    actionEntry: '#60a5fa', // 진입가 (primary-400)
    actionStopLoss: '#ef5350', // 손절가 (bearish)
    actionTakeProfit: '#26a69a', // 목표가 (bullish)

    // Ichimoku Cloud
    ichimokuTenkan: '#2962ff',
    ichimokuKijun: '#e91e63',
    ichimokuSenkouA: '#26a69a',
    ichimokuSenkouB: '#ef5350',
    ichimokuChikou: '#9c27b0',
    ichimokuCloudBullish: '#26a69a20',
    ichimokuCloudBearish: '#ef535020',

    mfiLine: '#22d3ee',
    mfiOverbought: '#ef535060',
    mfiOversold: '#26a69a60',

    williamsRLine: '#c084fc',
    williamsROverbought: '#ef535060',
    williamsROversold: '#26a69a60',

    connorsRsiLine: '#f472b6',
    connorsRsiOverbought: '#ef535060',
    connorsRsiOversold: '#26a69a60',

    cmfLine: '#34d399',
    cmfZero: '#94a3b860',

    // Bollinger %B (BB 밴드 #818cf8와 구별되는 밝은 인디고)
    bollingerPercentBLine: '#a5b4fc',
    bollingerPercentBUpper: '#ef535060',
    bollingerPercentBLower: '#26a69a60',

    hurstLine: '#fbbf24',
    hurstReference: '#94a3b860',

    // Variance Ratio (CCI #fb923c와 구별되는 라임)
    varianceRatioLine: '#a3e635',
    varianceRatioReference: '#94a3b860',

    macdVLine: '#2dd4bf',
    macdVZero: '#94a3b860',
    forceIndexLine: '#fb7185',
    forceIndexZero: '#94a3b860',
    obvLine: '#7dd3fc',
    atrLine: '#fdba74',
    yangZhangLine: '#d8b4fe',
    ewmaVolatilityLine: '#6ee7b7',
    // Supertrend (trend 색 라인 — up/down) — DESIGN.md 추세 색 고정값(bullish teal / bearish red) 재사용
    supertrendUp: '#26a69a',
    supertrendDown: '#ef5350',
    // Parabolic SAR (trend 색 점) — DESIGN.md 추세 고정값 재사용
    parabolicSarUp: '#26a69a',
    parabolicSarDown: '#ef5350',
    // Chandelier Exit (trend 색 점선 stop) — DESIGN.md 추세 고정값 재사용
    chandelierLong: '#26a69a',
    chandelierShort: '#ef5350',
    // Elder Ray (bull/bear power 히스토그램)
    elderBullPower: '#26a69a',
    elderBearPower: '#ef5350',
    // Squeeze Momentum 히스토그램 (강=solid, 약=50% alpha) — DESIGN.md teal/red 기반
    squeezeMomentumUp: '#26a69a',
    squeezeMomentumUpWeak: '#26a69a80',
    squeezeMomentumDown: '#ef5350',
    squeezeMomentumDownWeak: '#ef535080',
    // Squeeze 상태 점 (추세 무관 상태 팔레트)
    squeezeOn: '#fbbf24',
    squeezeOff: '#94a3b8',
    squeezeNone: '#3b82f6',
    // Regression (alpha는 r2로 런타임 계산)
    regressionUp: '#26a69a',
    regressionDown: '#ef5350',
    // Elder Impulse (캔들 per-bar 색) — DESIGN.md teal/red + Elder blue 관례
    impulseBullish: '#26a69a', // green — EMA↑ & MACD-hist↑
    impulseBearish: '#ef5350', // red — 둘 다 ↓
    impulseNeutral: '#3b82f6', // blue — 혼조/전환; Elder 원저자 관례. macdLine과 같은 값이나 별 pane이라 공간상 겹치지 않음
    // SMC zones (가격 밴드 경계선) — DESIGN.md bearish/bullish/neutral 매핑
    smcPremium: '#ef5350', // 매도/저항 상단
    smcDiscount: '#26a69a', // 매수/지지 하단
    smcEquilibrium: '#94a3b8', // 50% 공정가 (neutral)
} as const;

/**
 * 라이트 테마에서만 달라지는 차트 크롬. `CHART_COLORS`의 부분집합이며 키 이름이
 * 같아야 한다(하단 타입이 강제). 지표 색은 정체성이라 두 테마 공통이다.
 *
 * 값은 `globals.css`의 라이트 블록과 짝을 이룬다:
 *   secondary-900(페이지) / secondary-700(보더) / secondary-500(흐린 텍스트)
 */
export const CHART_COLORS_LIGHT = {
    background: '#f7f8fa',
    grid: '#e6e8ec',
    text: '#565c66',
} as const satisfies Partial<Record<keyof typeof CHART_COLORS, string>>;

/** 차트 크롬 3키. lightweight-charts에 넘길 형태. */
export interface ChartChrome {
    background: string;
    grid: string;
    text: string;
}

/**
 * 현재 테마에 맞는 차트 크롬을 돌려준다.
 *
 * 인자를 받지 않고 DOM 속성을 직접 읽는 이유: 차트 초기화는 훅 여러 겹 아래에서
 * 일어나 테마 값을 prop으로 내리려면 중간 계층을 전부 고쳐야 한다. `data-theme`은
 * 인라인 스크립트가 첫 페인트 전에 찍어두므로 어느 시점에 읽어도 정확하다.
 *
 * 서버에서는 `document`가 없으므로 다크를 반환한다 — 차트는 클라이언트 전용
 * (`dynamic({ ssr: false })`)이라 실제로 서버에서 호출되지 않는다.
 */
export function getChartChrome(): ChartChrome {
    if (typeof document === 'undefined') {
        const { background, grid, text } = CHART_COLORS;
        return { background, grid, text };
    }
    const isLight =
        document.documentElement.getAttribute('data-theme') === 'light';
    const src = isLight ? CHART_COLORS_LIGHT : CHART_COLORS;
    return { background: src.background, grid: src.grid, text: src.text };
}

const PERIOD_COLOR_MAP: Record<number, string> = {
    5: CHART_COLORS.period5,
    10: CHART_COLORS.period10,
    20: CHART_COLORS.period20,
    60: CHART_COLORS.period60,
    120: CHART_COLORS.period120,
    200: CHART_COLORS.period200,
};

export function getPeriodColor(period: number): string {
    return PERIOD_COLOR_MAP[period] ?? CHART_COLORS.neutral;
}
