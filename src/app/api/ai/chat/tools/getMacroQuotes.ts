import 'server-only';
import {
    AGENT_MACRO_QUOTES_MAX,
    type AgentMacroInstrument,
} from '@y0ngha/siglens-core';
import type { ToolExecutor } from '@/app/api/ai/chat/tools/chatTools';
import { roundNumbersDeep } from '@/entities/bars/lib/roundIndicators';
import {
    getYahooMacroDailyCloses,
    getYahooMacroQuotes,
    type YahooMacroQuote,
} from '@/shared/api/yahoo/yahooMacroSource';
import { zonedDate } from '@/shared/lib/marketSessionDate';
import { logToolDegrade } from './logToolDegrade';
import { macroChanges, macroRange52w } from './macroQuoteMath';

interface InstrumentSpec {
    yahooSymbol: string;
    unit: string;
}

/** 모델이 고르는 키 → Yahoo 심볼·단위. 자유 심볼은 받지 않는다(열거는 core가 검증하고, 타입이 전 키 매핑을 강제한다). */
const INSTRUMENTS: Record<AgentMacroInstrument, InstrumentSpec> = {
    wti: { yahooSymbol: 'CL=F', unit: 'USD per barrel' },
    brent: { yahooSymbol: 'BZ=F', unit: 'USD per barrel' },
    gold: { yahooSymbol: 'GC=F', unit: 'USD per troy ounce' },
    silver: { yahooSymbol: 'SI=F', unit: 'USD per troy ounce' },
    copper: { yahooSymbol: 'HG=F', unit: 'USD per pound' },
    natural_gas: { yahooSymbol: 'NG=F', unit: 'USD per MMBtu' },
    sp500_futures: { yahooSymbol: 'ES=F', unit: 'index points' },
    nasdaq100_futures: { yahooSymbol: 'NQ=F', unit: 'index points' },
    dow_futures: { yahooSymbol: 'YM=F', unit: 'index points' },
    russell2000_futures: { yahooSymbol: 'RTY=F', unit: 'index points' },
    dollar_index: { yahooSymbol: 'DX-Y.NYB', unit: 'index' },
    usd_krw: { yahooSymbol: 'KRW=X', unit: 'KRW per USD' },
    jpy_krw: { yahooSymbol: 'JPYKRW=X', unit: 'KRW per JPY' },
    eur_krw: { yahooSymbol: 'EURKRW=X', unit: 'KRW per EUR' },
    cny_krw: { yahooSymbol: 'CNYKRW=X', unit: 'KRW per CNY' },
    usd_jpy: { yahooSymbol: 'JPY=X', unit: 'JPY per USD' },
    eur_usd: { yahooSymbol: 'EURUSD=X', unit: 'USD per EUR' },
};

function isInstrument(value: unknown): value is AgentMacroInstrument {
    return typeof value === 'string' && Object.hasOwn(INSTRUMENTS, value);
}

/** 입력 정리: 열거 밖 값은 버리고 중복은 첫 등장만 남긴다. 개수 상한 검사는 호출부가 한다. */
function pickInstruments(raw: unknown): AgentMacroInstrument[] {
    const list = Array.isArray(raw) ? raw : [];
    return [...new Set(list.filter(isInstrument))];
}

function contractOf(quote: YahooMacroQuote) {
    if (quote.quoteType !== 'FUTURE') return null;
    return {
        name: quote.name,
        expiry: quote.contractExpiryIso?.slice(0, 10) ?? null,
    };
}

async function loadInstrument(
    instrument: AgentMacroInstrument,
    quote: YahooMacroQuote | null,
    nowIso: string
) {
    if (quote === null) return { instrument, found: false as const };
    const { yahooSymbol, unit } = INSTRUMENTS[instrument];
    const daily = await getYahooMacroDailyCloses(yahooSymbol);
    const asOf = quote.timeIso ?? nowIso;
    // 기준일 산식은 시세의 달력 날짜를 일봉과 **같은 시간대**로 읽는다(일봉이 없으면 UTC) — 다른 시간대로 읽으면
    // 자정 근처 시세가 일봉과 하루 어긋난다.
    const quoteDate = zonedDate(new Date(asOf), daily?.timeZone ?? 'UTC');
    return {
        instrument,
        found: true as const,
        name: quote.name,
        price: quote.price,
        changePct: quote.changePct,
        unit,
        currency: quote.currency,
        contract: contractOf(quote),
        quoteDelayMinutes: quote.delayMinutes,
        asOf,
        changes: daily && macroChanges(quote.price, quoteDate, daily.rows),
        range52w: daily && macroRange52w(quote.price, quoteDate, daily.rows),
    };
}

/**
 * 원자재·지수 선물·달러 인덱스·원달러 시세. 항목마다 독립이라(`allSettled`) 한 항목의 실패가 나머지를
 * 비우지 않는다. 일봉을 못 받으면 시세만 돌려주고 `changes`·`range52w`는 `null`이다.
 * 연속 선물(`=F`) 일봉은 월물 교체를 이어 붙인 값이라 3개월·1년 변화에 롤 효과가 섞인다(도구 설명이 안내한다).
 */
export const getMacroQuotesTool: ToolExecutor = async args => {
    const instruments = pickInstruments(args.instruments);
    if (instruments.length === 0) return { error: 'no_instruments' };
    // 조용히 자르면 모델이 요청한 항목이 빠진 줄 모르고 답한다 — 거절하고 아무것도 받지 않는다.
    if (instruments.length > AGENT_MACRO_QUOTES_MAX)
        return { error: 'too_many_instruments', max: AGENT_MACRO_QUOTES_MAX };
    const nowIso = new Date().toISOString();
    // 시세는 캐시 miss만 묶어 한 번에 받는다(실패하면 전부 null이라 항목마다 found:false).
    const quotes = await getYahooMacroQuotes(
        instruments.map(instrument => INSTRUMENTS[instrument].yahooSymbol)
    ).catch((error: unknown) => {
        logToolDegrade('get_macro_quotes', 'quotes', error);
        return new Map<string, YahooMacroQuote | null>();
    });
    // 종목마다 자기 실패를 자기 자리에서 `found: false`로 바꾼다 — 한 종목의 실패가 나머지를 비우지 않는다.
    const items = await Promise.all(
        instruments.map(instrument =>
            loadInstrument(
                instrument,
                quotes.get(INSTRUMENTS[instrument].yahooSymbol) ?? null,
                nowIso
            ).catch((error: unknown) => {
                logToolDegrade('get_macro_quotes', instrument, error);
                return { instrument, found: false as const };
            })
        )
    );
    return roundNumbersDeep({
        asOf: nowIso,
        source: 'Yahoo Finance (futures and FX quotes, delayed)',
        quotes: items,
    });
};
