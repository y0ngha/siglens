/**
 * 차트 표시용 기준선 임계 — core 도메인 상수가 없는 지표의 시각화 기준선.
 * (mfi·connorsRsi·cmf는 core 상수 사용: MFI_OVERBOUGHT/OVERSOLD_LEVEL,
 *  CRSI_OVERBOUGHT/OVERSOLD, CMF_BULLISH_CROSS_LEVEL.)
 */

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
