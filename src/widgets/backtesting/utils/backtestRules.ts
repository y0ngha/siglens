/**
 * 이번 실행(v8, `scripts/backtests/v8/3-run-ai.ts`)의 시뮬레이션 규칙 값. 전략 설명 문구에 ICU 인자로
 * 넣는다(I18-6) — 문구에 숫자를 박아 두면 규칙을 바꿀 때 문구만 남아 어긋난다.
 */
export const BACKTEST_RULES = {
    /** 이전 분석을 찾는 창(거래일). core `PRIOR_ANALYSIS_WINDOW_BARS`. */
    priorWindowBars: 21,
    /** 프롬프트에 넣는 이전 분석 최대 건수. core `PRIOR_ANALYSIS_LIMIT`. */
    priorLimit: 7,
    /** 급락 매수 규칙의 최대 보유(거래일). 프롬프트 "after about 10 trading days". */
    sellOffMaxDays: 10,
    /** 일반 매매의 최대 보유(거래일). */
    maxHoldDays: 60,
} as const;

/** 실행 정보의 모델 id → 화면 이름. */
export const MODEL_DISPLAY_NAME: Readonly<Record<string, string>> = {
    'deepseek-v4.1-flash': 'DeepSeek V4.1 Flash',
};
