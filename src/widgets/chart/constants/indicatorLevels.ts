/**
 * 차트 표시용 기준선 임계 — 시각화 전용 기준선 상수.
 *
 * 주의: mfi·cmf·connorsRsi 임계는 본래 core(@y0ngha/siglens-core)에서 가져올
 * 예정이었으나, core 0.20.0 배럴(index)은 MFI_OVERBOUGHT/OVERSOLD_LEVEL,
 * CMF_BULLISH_CROSS_LEVEL, CRSI_OVERBOUGHT/OVERSOLD를 export하지 않는다
 * (deep import는 package exports map상 금지·차단). 차트 렌더 기준선은 분석 로직이
 * 아닌 시각화 전용 임계이므로, Williams %R/Bollinger %B/Hurst/Variance Ratio와
 * 동일하게 이 파일에 로컬 상수로 둔다. core가 해당 상수를 배럴로 노출하면 교체.
 */

// MFI: 0~100 오실레이터, 통상 80/20 (RSI와 동일 컨벤션).
export const MFI_OVERBOUGHT_LEVEL = 80;
export const MFI_OVERSOLD_LEVEL = 20;

// Connors RSI: 0~100, 통상 90/10 (core CRSI_OVERBOUGHT/OVERSOLD와 동일 값).
export const CONNORS_RSI_OVERBOUGHT_LEVEL = 90;
export const CONNORS_RSI_OVERSOLD_LEVEL = 10;

// CMF: -1~1, 0선 교차가 강세/약세 전환 기준.
export const CMF_ZERO_LEVEL = 0;

// Williams %R: -100~0 오실레이터, 통상 -20/-80.
export const WILLIAMS_R_OVERBOUGHT_LEVEL = -20;
export const WILLIAMS_R_OVERSOLD_LEVEL = -80;

// Bollinger %B: 0~1, 밴드 상단/하단.
export const BOLLINGER_PERCENT_B_UPPER_LEVEL = 1;
export const BOLLINGER_PERCENT_B_LOWER_LEVEL = 0;

// Hurst 지수: 0.5 = 랜덤워크 기준(>0.5 추세, <0.5 평균회귀).
export const HURST_RANDOM_WALK_LEVEL = 0.5;

// Variance Ratio: 1.0 = 랜덤워크 기준(>1 추세, <1 평균회귀).
export const VARIANCE_RATIO_RANDOM_WALK_LEVEL = 1;
