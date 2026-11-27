/**
 * `get_macro_quotes`가 받는 계기: 원자재, 지수 선물, 달러 인덱스와 환율. SIGLENS 종목이 아니어서(종목 페이지가 없고
 * `CL=F` 같은 선물 기호는 종목 모양 검사를 통과하지 못한다) 모델은 이 닫힌 목록에서 고르고, 실행기가 각 키를
 * 공급자 기호로 바꾼다. 원래 core가 내보내던 값(같은 이름·같은 값)이다.
 */
export const AGENT_MACRO_INSTRUMENTS = [
    'wti',
    'brent',
    'gold',
    'silver',
    'copper',
    'natural_gas',
    'sp500_futures',
    'nasdaq100_futures',
    'dow_futures',
    'russell2000_futures',
    'dollar_index',
    'usd_krw',
    'jpy_krw',
    'eur_krw',
    'cny_krw',
    'usd_jpy',
    'eur_usd',
] as const;
/** {@link AGENT_MACRO_INSTRUMENTS} 중 하나. */
export type AgentMacroInstrument = (typeof AGENT_MACRO_INSTRUMENTS)[number];

/**
 * 한 호출이 받는 최대 계기 수. 더 긴 목록은 자르지 않고 거절한다(`too_many_instruments`) — 조용히 자르면 모델이
 * 빠진 계기를 말없이 건너뛰거나 기억으로 채웠다.
 */
export const AGENT_MACRO_QUOTES_MAX = 8;
