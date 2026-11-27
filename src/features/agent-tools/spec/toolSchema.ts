import { AGENT_BARS_TIMEFRAMES } from '@y0ngha/siglens-core';

/**
 * 공급자 timeframe 여섯 개(5Min~1Day). core `PROVIDER_TIMEFRAMES`는 공개 API 밖이라 core가 내보내는
 * `AGENT_BARS_TIMEFRAMES`(공급자 timeframe + 일봉을 묶은 1Week·1Month)에서 묶은 두 개를 빼서 얻는다.
 *
 * 분석 도구(`get_cached_analysis`·`run_fresh_analysis`)는 core가 주봉 분석을 만들 수 있어도 이 열거를 쓴다.
 * 모델에 주봉 분석을 열어 주는 것은 도구 설명 변경(도구 선택 정확도)이라 평가 전까지 열지 않는다.
 */
export const TIMEFRAME_ENUM: readonly string[] = AGENT_BARS_TIMEFRAMES.filter(
    timeframe => timeframe !== '1Week' && timeframe !== '1Month'
);

/** `get_bars_indicators`가 받는 timeframe: 공급자 timeframe에 일봉으로 묶는 주봉·월봉을 더한 것. */
export const BARS_TIMEFRAME_ENUM: readonly string[] = AGENT_BARS_TIMEFRAMES;

/** 종목 하나를 받는 도구들의 공통 `symbol` 인자. */
export const SYMBOL_PROP = {
    type: 'string',
    description:
        'Ticker symbol as used on SIGLENS (e.g. AAPL, 005930.KS, BTCUSD). Use search_ticker first when unsure.',
} as const;
