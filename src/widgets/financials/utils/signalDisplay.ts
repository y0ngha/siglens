/**
 * 재무 신호 칩의 표시 규칙 — 방향별 색과 종류별 번역 키.
 */
import type {
    FinancialSignalDirection,
    FinancialSignalType,
} from '@y0ngha/siglens-core';

/** 신호 방향별 칩 색. */
export const SIGNAL_CHIP_CLASS: Record<FinancialSignalDirection, string> = {
    positive:
        'bg-chart-bullish/10 text-ui-success-text border-chart-bullish/20',
    negative: 'bg-chart-bearish/10 text-ui-danger-text border-chart-bearish/20',
    neutral: 'bg-secondary-700 text-secondary-300 border-secondary-600',
};

/**
 * 신호 종류 → `widgets.financials.signalType` 카탈로그 키.
 *
 * core의 `labelKo`는 한국어 문자열이라 다른 로케일에서도 한국어로 나간다. 안정적인 `type`으로
 * 번역을 찾는다. `Record`라 core가 종류를 추가하면 여기서 컴파일 오류가 난다.
 *
 * 소비하는 `.tsx`는 이 키를 자기 파일의 번역자에 직접 넘겨야 한다(`tSignal(SIGNAL_LABEL_KEY[type])`) —
 * extract.mjs의 동적 키 탐지가 번역자를 호출하는 파일만 보기 때문이다.
 */
export const SIGNAL_LABEL_KEY: Record<FinancialSignalType, string> = {
    revenue_accel: 'revenueAccel',
    operating_leverage: 'operatingLeverage',
    growth_decline: 'growthDecline',
    operating_income_growth: 'operatingIncomeGrowth',
    earnings_quality_good: 'earningsQualityGood',
    accrual_warning: 'accrualWarning',
    margin_expansion: 'marginExpansion',
    margin_contraction: 'marginContraction',
    net_cash: 'netCash',
    debt_rising: 'debtRising',
    fcf_solid: 'fcfSolid',
    fcf_negative: 'fcfNegative',
    capex_heavy: 'capexHeavy',
    fcf_growth: 'fcfGrowth',
};
