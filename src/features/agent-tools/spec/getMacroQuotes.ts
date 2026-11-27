import { type AgentToolDefinition } from '@y0ngha/siglens-core';
import {
    AGENT_MACRO_INSTRUMENTS,
    AGENT_MACRO_QUOTES_MAX,
} from '@/features/agent-tools/lib/macroInstruments';

/** 열거값으로 쓰는 문자열 목록. 계기 이름 자체는 실행기가 공급자 심볼로 바꾸는 core의 계약 목록이다. */
const MACRO_INSTRUMENT_ENUM: readonly string[] = AGENT_MACRO_INSTRUMENTS;

/**
 * `get_macro_quotes` 도구 명세: 모델이 읽는 설명과 인자 스키마.
 * 결과 필드를 바꾸면 같은 PR에서 이 설명도 고치고 `AGENT_TOOLSET_VERSION`을 올린다.
 */
export const GET_MACRO_QUOTES_SPEC: AgentToolDefinition = {
    name: 'get_macro_quotes',
    description: `Prices of commodities, index futures, the US dollar index and the won-dollar rate — instruments that are not SIGLENS symbols: wti and brent (crude oil, USD per barrel), gold and silver (USD per troy ounce), copper (USD per pound), natural_gas (USD per MMBtu), sp500_futures, nasdaq100_futures, dow_futures and russell2000_futures (index points), dollar_index (DXY), and the exchange rates usd_krw (won per US dollar), jpy_krw (won per 1 yen — Korean quotes are per 100 yen, so multiply by 100 and say so when answering in that convention), eur_krw (won per euro), cny_krw (won per yuan), usd_jpy (yen per US dollar) and eur_usd (US dollars per euro). At most ${AGENT_MACRO_QUOTES_MAX} per call: a longer list is rejected with error too_many_instruments, so split it into two calls. Each item: {instrument, found, name, price, changePct (vs the previous settlement or close), unit, currency, contract ({name, expiry}: the front-month futures contract the price belongs to; null when the instrument is not a futures contract), quoteDelayMinutes, asOf, changes ('1week', '1month', '3months', '1year': {baseDate, baseClose, pct} or null), range52w ({high, highDate, low, lowDate, fromHighPct, fromLowPct} or null)} — changes and range52w are precomputed from daily closes: quote them with their dates, do not recompute them; a null entry or a null range52w means that history could not be loaded: leave it out. A futures price (contract is not null) is the front-month contract (근월물 in Korean, never 전월물): say once that it is the front-month futures price, never the spot price. When quoteDelayMinutes is greater than 0 say the quote is delayed by that many minutes and never call it real-time; when it is 0 or null do not mention a delay. The daily history of a futures instrument is a continuous series stitched across contract rolls, so say that a 3-month or 1-year change includes roll effects when you quote one. An item with found false carries only {instrument, found} — its quote could not be fetched: say so, never substitute an ETF price or a figure from memory. An empty list is rejected with error no_instruments. Use for oil, gold, silver, copper, natural gas, index futures, the dollar index and the listed exchange rates (유가, WTI, 브렌트유, 금값, 은값, 구리, 천연가스, 나스닥 선물, S&P 선물, 다우 선물, 달러 인덱스, 원달러 환율, 엔화 환율, 유로 환율, 위안화 환율). An instrument that is not on the list (another currency pair, another futures contract) is not available from this tool. Not for stocks, ETFs, crypto or index levels (get_quote, get_market_overview) and not for Treasury yields or policy rates (get_economy).`,
    costClass: 'free',
    inputSchema: {
        type: 'object',
        properties: {
            instruments: {
                type: 'array',
                description: `1 to ${AGENT_MACRO_QUOTES_MAX} instruments from the list`,
                items: { type: 'string', enum: MACRO_INSTRUMENT_ENUM },
            },
        },
        required: ['instruments'],
        additionalProperties: false,
    },
};
