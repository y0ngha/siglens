import type { AgentToolSpec } from '@y0ngha/siglens-core';
import {
    CHART_DATA_ALL_INDICATORS,
    CHART_DATA_INDICATOR_NAMES,
} from '@/entities/bars/lib/chartDataIndicators';
import { TIMEFRAMES } from '@/shared/config/market';
import { PUBLIC_API_CHART_DATA } from '@/shared/config/publicApi';

const {
    tool: CHART_DATA_TOOL,
    defaultBars,
    minBars,
    maxBars,
} = PUBLIC_API_CHART_DATA;

/**
 * 공개 API 전용 도구 — 에이전트(ai.siglens.io)에는 없고 core 스펙에도 없다. 같은 `validateArgs` 경로로 인자를
 * 검증하려고 core와 같은 JSON Schema 부분집합으로 쓴다. 지표 이름 열거는 `CHART_DATA_INDICATOR_NAMES`(core의
 * `IndicatorResult`와 1:1)에서 파생한다.
 */
export const CHART_DATA_TOOL_SPEC: AgentToolSpec = {
    name: CHART_DATA_TOOL,
    description: [
        "Price bars (OHLCV) AND SIGLENS's computed technical indicators for one symbol in a single call, so a chart can be rebuilt or analysed from one response. The indicators are the same values the SIGLENS website chart shows for the same bars: they are computed over the full loaded history and only the last `bars` bars are returned, so the warm-up of each indicator does not distort the window. No AI is involved and nothing is billed beyond the normal `data` rate limit.",
        '',
        'Response `data`: `{ symbol, timeframe, bars, time, ohlcv, indicators, meta }`. `time` is unix seconds, ascending. `ohlcv` is `{ open, high, low, close, volume }`. Every per-bar series has exactly `bars` entries aligned to `time` (index i is the bar at `time[i]`), with `null` where the indicator has no value yet (warm-up). Indicators with several fields are returned as an object of arrays using the SIGLENS field names, for example `macd: { macd, signal, histogram }`, `bollinger: { upper, middle, lower }`, `dmi: { diPlus, diMinus, adx }`, `stochastic: { percentK, percentD }`, `ichimoku: { tenkan, kijun, senkouA, senkouB, chikou }`, `supertrend: { supertrend, trend }`, `parabolicSar: { sar, trend }`. `ma` and `ema` are keyed by period, for example `ma: { "20": [...], "50": [...] }`, for every period SIGLENS computes.',
        '',
        'Two indicators are not per-bar series: `volumeProfile` (`{ poc, vah, val, profile }`, computed over the full loaded history) and `smc` (swing points, order blocks, fair value gaps, equal levels, premium/discount zones and structure breaks, computed over the full loaded history). They are returned as snapshots, not aligned to `time`. Bar indexes inside `smc` (`index`, `startIndex`, `firstIndex`, `secondIndex`) are rebased to the returned window (index 0 = `time[0]`). An entry whose indexes ALL fall before the window is left out, except an order block or fair value gap that is still unmitigated (`isMitigated: false`), because it is still an active price level: such an entry is kept with its index set to `null` and `startsBeforeWindow: true`. An entry with some indexes before the window and some inside (for example an equal level whose first touch is earlier) is kept too: the index before the window becomes `null` and the entry gets `startsBeforeWindow: true`. So any `smc` index may be `null` whenever `startsBeforeWindow` is true — check it before reading `time[index]`.',
        '',
        '`meta` carries `source`, `asOf` (ISO time of the last bar), `lastBarTime` (unix seconds), `currency`, `quoteDelayMinutes` and `delayed` (true when quotes for this market are delayed, for example Korean stocks). Timeframes that are not open to the account tier are rejected with 403 `timeframe_not_allowed`; a symbol with no bars returns 404 `bars_not_found`.',
    ].join('\n'),
    costClass: 'free',
    inputSchema: {
        type: 'object',
        properties: {
            symbol: {
                type: 'string',
                description:
                    'Ticker symbol as used on SIGLENS (e.g. AAPL, 005930.KS, BTCUSD). Use search_ticker first when unsure.',
            },
            timeframe: {
                type: 'string',
                enum: TIMEFRAMES,
                description: 'Bar interval; 1Day for most questions',
            },
            indicators: {
                type: 'array',
                description: `Indicators to return, several at once. Omit it, send an empty array or include "${CHART_DATA_ALL_INDICATORS}" to get all ${CHART_DATA_INDICATOR_NAMES.length} indicators. Unknown names are rejected with 400 invalid_args.`,
                items: {
                    type: 'string',
                    enum: [
                        CHART_DATA_ALL_INDICATORS,
                        ...CHART_DATA_INDICATOR_NAMES,
                    ],
                },
            },
            bars: {
                type: 'integer',
                minimum: minBars,
                maximum: maxBars,
                description: `How many most recent bars to return (default ${defaultBars})`,
            },
        },
        required: ['symbol', 'timeframe'],
        additionalProperties: false,
    },
};
