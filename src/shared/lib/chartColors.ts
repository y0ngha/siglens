import { THEME_ATTRIBUTE } from './theme';

/**
 * 다크 팔레트. **제품 코드에서는 쓰지 말고 `CHART_COLORS`를 쓴다** — 그쪽이
 * 현재 테마에 맞는 값을 돌려준다. 이 객체는 키 집합과 다크 값의 원천이다.
 *
 * 내보내는 이유는 하나: `CHART_COLORS`는 게터라 값을 읽는 순간의 테마에 묶여
 * 있어서, 두 팔레트를 **나란히** 검사해야 하는 대비 가드가 원본을 봐야 한다.
 */
export const CHART_COLORS_RAW_DARK = {
    /*
     * 차트 크롬(배경 / 그리드 / 축 텍스트). 값은 `globals.css`의
     * secondary-900 / 800·700 사이 / 500과 짝을 이룬다(`DESIGN.md`의 단일
     * 진실 공급원 규약).
     *
     * lightweight-charts는 CSS 변수를 읽지 못해 JS 리터럴이어야 한다.
     *
     * 한때 "이 3키만 테마에 따라 변한다"고 적혀 있었다. 틀렸다 — 지표 색을
     * 두 테마 공용으로 두면 라이트 배경에서 112개 중 75개가 3:1을 밑돈다.
     * 테마별 값은 `CHART_COLORS_LIGHT`에 있고, 읽는 쪽은 `CHART_COLORS`가
     * 알아서 고른다.
     */
    background: '#09090b',
    grid: '#1f1f26',
    text: '#96979f',

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
 * 라이트 테마 오버라이드.
 *
 * 크롬 3키(배경·그리드·축 텍스트)로 시작했지만 그것만으로는 **지표 색이
 * 라이트 배경에서 읽히지 않는다.** 팔레트가 다크 배경 전용으로 튜닝돼 있어
 * 112개 중 75개가 `#f7f8fa` 위에서 WCAG 1.4.11의 3:1을 밑돌았고, 최악은
 * 1.36:1이었다(Donchian·Keltner). 차트는 canvas라 DOM 접근성 프로브가
 * 원리적으로 볼 수 없어 배포 전 감사 12라운드가 전부 놓쳤다.
 *
 * 아래 값들은 고른 것이 아니라 **도출한 것**이다:
 *  1. 색상과 채도를 유지한 채 명도만 낮춰 `#f7f8fa` 위 3.5:1을 맞춘다.
 *  2. 그러면 전부 비슷한 명도로 모여 서로 구분이 사라진다. 대비비로 재면
 *     1.0이 나오는데 그건 결함이 아니라 같은 배경에 맞춘 결과다 — 구분은
 *     휘도가 아니라 색상이 나르며, 다크 팔레트도 같은 성질이다. 그래서
 *     지각 거리(ΔE)로 다시 재고, 같은 pane에 동시에 뜨는 색들의 최소 ΔE가
 *     커지도록 색상을 회전시킨다.
 *  3. 회전은 **계열 밖으로 나가지 않게** 묶어 둔다. 제약 없이 최적화하면
 *     Donchian 중앙선이 빨강이 되는데 이 제품에서 빨강은 하락이다.
 *     상승·하락 캔들색은 의미색이라 아예 고정한다.
 *
 * 결과: 최악 대비 3.49:1, 가격 pane 최소 ΔE 18.6 — 다크 팔레트의 같은 지표가
 * 8.5이므로 오히려 더 잘 갈린다. 회귀는 `chartPaletteContrastGuard`가 막는다.
 *
 * 크롬 3키는 `globals.css`의 라이트 블록과 짝을 이룬다:
 *   secondary-900(페이지) / secondary-700(보더) / secondary-500(흐린 텍스트)
 */
export const CHART_COLORS_LIGHT = {
    background: '#f7f8fa',
    grid: '#e6e8ec',
    text: '#565c66',
    bullish: '#1e9388',
    neutral: '#7a81a9',
    volumeBullish: '#1e938880',
    period10: '#de5b00',
    period20: '#ab7c02',
    period60: '#17992d',
    bollingerUpper: '#8a6cfa',
    bollingerMiddle: '#7a81a9',
    bollingerLower: '#8a6cfa',
    bollingerBackground: '#8a6cfa20',
    keltnerUpper: '#1789d7',
    keltnerMiddle: '#0f8fb1',
    keltnerLower: '#1789d7',
    keltnerBackground: '#1789d720',
    donchianUpper: '#8f8600',
    donchianMiddle: '#c66e01',
    donchianLower: '#8f8600',
    donchianBackground: '#8f860020',
    macdSignal: '#b87403',
    macdHistogramBullish: '#1e9388',
    rsiLine: '#8f6afc',
    rsiOversold: '#1e938860',
    dmiPlus: '#1e9388',
    dmiAdx: '#b87403',
    stochasticK: '#f42d95',
    stochasticD: '#028dca',
    stochasticOversold: '#1e938860',
    stochRsiK: '#a18100',
    stochRsiD: '#0782fd',
    stochRsiOversold: '#1e938860',
    cciLine: '#d76100',
    cciOversold: '#1e938860',
    cciZero: '#7a81a960',
    vwap: '#c940fb',
    vpPoc: '#b87403',
    vpVal: '#1d966a',
    trendlineAscending: '#1e9388',
    supportLine: '#1e9388',
    actionEntry: '#0782fd',
    actionTakeProfit: '#1e9388',
    ichimokuSenkouA: '#1e9388',
    ichimokuCloudBullish: '#1e938820',
    mfiLine: '#0991a5',
    mfiOversold: '#1e938860',
    williamsRLine: '#ac58ff',
    williamsROversold: '#1e938860',
    connorsRsiLine: '#f42d95',
    connorsRsiOversold: '#1e938860',
    cmfLine: '#1d966a',
    cmfZero: '#7a81a960',
    bollingerPercentBLine: '#5c78fe',
    bollingerPercentBLower: '#1e938860',
    hurstLine: '#ab7b00',
    hurstReference: '#7a81a960',
    varianceRatioLine: '#60920f',
    varianceRatioReference: '#7a81a960',
    macdVLine: '#1b9384',
    macdVZero: '#7a81a960',
    forceIndexLine: '#fe2847',
    forceIndexZero: '#7a81a960',
    obvLine: '#008bce',
    atrLine: '#ce6900',
    yangZhangLine: '#aa59ff',
    ewmaVolatilityLine: '#159663',
    supertrendUp: '#1e9388',
    parabolicSarUp: '#1e9388',
    chandelierLong: '#1e9388',
    elderBullPower: '#1e9388',
    squeezeMomentumUp: '#1e9388',
    squeezeMomentumUpWeak: '#1e938880',
    squeezeOn: '#ab7b00',
    squeezeOff: '#7a81a9',
    regressionUp: '#1e9388',
    impulseBullish: '#1e9388',
    smcDiscount: '#1e9388',
    smcEquilibrium: '#7a81a9',
} as const satisfies Partial<
    Record<keyof typeof CHART_COLORS_RAW_DARK, string>
>;

/** 현재 문서가 라이트 테마인가. 서버에서는 항상 false(다크). */
function isLightTheme(): boolean {
    return (
        typeof document !== 'undefined' &&
        document.documentElement.getAttribute(THEME_ATTRIBUTE) === 'light'
    );
}

/**
 * 현재 테마에 맞는 차트 색.
 *
 * **접근 시점에 값을 고른다.** 소비처가 41개 파일 188곳이라 전부
 * `chartColor('x')` 같은 접근자로 바꾸면 변경 범위가 거대해지고 그만큼 실수가
 * 섞인다.
 * 게터로 두면 기존 `CHART_COLORS.bullish` 표기가 그대로 테마를 따른다.
 *
 * 한계: lightweight-charts 시리즈는 생성 시점에 읽은 값을 들고 있다. 첫 로드는
 * 인라인 스크립트가 페인트 전에 `data-theme`을 찍으므로 언제나 정확하고,
 * 세션 중 토글은 `useChartThemeSync`가 다시 칠한다.
 */
export const CHART_COLORS = Object.defineProperties(
    {},
    Object.fromEntries(
        Object.keys(CHART_COLORS_RAW_DARK).map(key => [
            key,
            {
                enumerable: true,
                get(): string {
                    const light = (
                        CHART_COLORS_LIGHT as Partial<Record<string, string>>
                    )[key];
                    return isLightTheme() && light !== undefined
                        ? light
                        : (CHART_COLORS_RAW_DARK as Record<string, string>)[
                              key
                          ];
                },
            },
        ])
    )
) as Record<keyof typeof CHART_COLORS_RAW_DARK, string>;

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
    // `CHART_COLORS`가 이미 테마를 보고 값을 고르므로 여기서 다시 갈라지지
    // 않는다. 한때 이 함수가 직접 분기했는데, 그러면 테마 판정이 두 곳에
    // 생기고 한쪽만 고쳐지는 형태가 된다.
    const { background, grid, text } = CHART_COLORS;
    return { background, grid, text };
}

/**
 * 기간별 MA 색.
 *
 * **맵을 모듈 상수로 두지 않는다.** `CHART_COLORS`는 접근 시점에 테마를 보는
 * 게터라, 모듈 로드 때 한 번 읽어 객체에 담으면 그 값이 다크로 굳는다 —
 * 라이트에서 이 색들만 조용히 옛 값으로 남는다. 같은 이유로 트리 전체에서
 * 모듈 스코프 스냅샷을 걷어냈다.
 */
export function getPeriodColor(period: number): string {
    switch (period) {
        case 5:
            return CHART_COLORS.period5;
        case 10:
            return CHART_COLORS.period10;
        case 20:
            return CHART_COLORS.period20;
        case 60:
            return CHART_COLORS.period60;
        case 120:
            return CHART_COLORS.period120;
        case 200:
            return CHART_COLORS.period200;
        default:
            return CHART_COLORS.neutral;
    }
}
