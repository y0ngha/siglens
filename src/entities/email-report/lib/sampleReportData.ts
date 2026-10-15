import { calculateMA, type Bar } from '@y0ngha/siglens-core';
import {
    SECONDS_PER_DAY,
    SECONDS_PER_HOUR,
    SECONDS_PER_MINUTE,
} from '@/shared/config/time';
import { localePath, type Locale } from '@/shared/i18n/locales';
import type { SymbolBrief, SymbolReport } from '../reportModel';
import { REPORT_CHART_MA_PERIODS } from './buildReportChartImage';
import type {
    BuildReportEmailInput,
    ReportEmailSection,
    ReportEmailTranslator,
    SignalLabelResolver,
    SymbolBriefRow,
} from '../templates/reportEmail';

/**
 * 비회원에게 보여 주는 "메일이 이렇게 온다" 샘플의 고정 데이터.
 *
 * 실제 메일과 **같은 렌더 경로**(`buildReportEmail`)를 타도록 `SymbolReport`·`SymbolBrief`
 * 모양 그대로 만든다 — 손으로 줄인 모양을 쓰면 템플릿이 바뀔 때 샘플만 조용히 갈라진다.
 * 시장 데이터 조회는 하지 않는다: 봉은 여기서 결정적으로 만들고, 산문은 번역 카탈로그
 * (`entities.email-report.sample`)에서 온다. 화면의 수치와 문장은 전부 예시다.
 */

/** 샘플 메일의 발송일(고정). 날짜가 바뀌어도 샘플 HTML과 차트 이미지가 흔들리지 않게 한다. */
export const SAMPLE_REPORT_DATE = '2026-10-14';

/** 전체 카드로 싣는 종목. 차트 이미지도 이 종목들만 만든다. */
export const SAMPLE_CHART_SYMBOLS = ['NVDA', 'AAPL'] as const;
export type SampleChartSymbol = (typeof SAMPLE_CHART_SYMBOLS)[number];

export const SAMPLE_CHART_PATH = '/api/email-report/sample-chart';

export function isSampleChartSymbol(value: string): value is SampleChartSymbol {
    return (SAMPLE_CHART_SYMBOLS as readonly string[]).includes(value);
}

/** 샘플 차트 이미지 URL. 사이트 상대 경로라 어느 환경에서 열어도 같은 배포의 이미지를 받는다. */
export function sampleChartUrl(symbol: SampleChartSymbol): string {
    return `${SAMPLE_CHART_PATH}/${symbol}`;
}

interface BarSeed {
    /** 첫 봉 시가. */
    start: number;
    /** 하루 평균 드리프트(분수). */
    drift: number;
    /** 하루 변동 폭(분수). */
    volatility: number;
    seed: number;
}

const SAMPLE_BAR_SEEDS: Record<SampleChartSymbol, BarSeed> = {
    NVDA: { start: 142, drift: 0.0034, volatility: 0.018, seed: 3 },
    AAPL: { start: 214, drift: 0.0012, volatility: 0.011, seed: 66 },
};

const SAMPLE_BAR_COUNT = 90;
/**
 * 미국 정규장 시작(UTC 13:30)의 하루 안 초. 봉 시각이 날짜와 어긋나지 않게 한다.
 * 시간 단위 환산은 `shared/config/time`을 쓴다.
 */
const MARKET_OPEN_UTC_HOUR = 13;
const MARKET_OPEN_UTC_MINUTE = 30;
const MARKET_OPEN_SECONDS =
    MARKET_OPEN_UTC_HOUR * SECONDS_PER_HOUR +
    MARKET_OPEN_UTC_MINUTE * SECONDS_PER_MINUTE;
/** 주말이 끼어도 `count`개 거래일을 채울 만큼 거꾸로 훑는 달력일 배수. */
const CALENDAR_DAYS_PER_TRADING_DAY = 2;

interface RandomDraw {
    value: number;
    state: number;
}

/**
 * 선형 합동 생성기의 한 걸음 — 상태를 받아 `[0, 1)` 값과 다음 상태를 돌려준다.
 * `Math.random`도 클로저 변수도 없이, 같은 시드에서 늘 같은 수열을 낸다.
 */
function nextRandom(state: number): RandomDraw {
    const next = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return { value: next / 0x1_0000_0000, state: next };
}

/** 상태를 이어 받으며 `count`개를 뽑는다. */
function drawRandoms(
    state: number,
    count: number
): { values: number[]; state: number } {
    return Array.from({ length: count }).reduce<{
        values: number[];
        state: number;
    }>(
        acc => {
            const draw = nextRandom(acc.state);
            return {
                values: [...acc.values, draw.value],
                state: draw.state,
            };
        },
        { values: [], state }
    );
}

function round2(value: number): number {
    return Math.round(value * 100) / 100;
}

/** `SAMPLE_REPORT_DATE`에서 거꾸로 세어 주말을 건너뛴 거래일(초 단위 epoch) 목록, 오래된 순. */
function sampleTradingTimes(count: number): number[] {
    const end = Date.parse(`${SAMPLE_REPORT_DATE}T00:00:00Z`) / 1_000;
    return Array.from(
        { length: count * CALENDAR_DAYS_PER_TRADING_DAY },
        (_, back) => end - back * SECONDS_PER_DAY
    )
        .filter(day => {
            const weekday = new Date(day * 1_000).getUTCDay();
            return weekday !== 0 && weekday !== 6;
        })
        .slice(0, count)
        .map(day => day + MARKET_OPEN_SECONDS)
        .reverse();
}

interface BarWalk {
    bars: Bar[];
    previousClose: number;
    rngState: number;
}

/**
 * 샘플 일봉. 모양은 실제 `Bar` 그대로이고, 값은 시드 고정 난수 보행이라 빌드마다 같다.
 * 가격은 센트까지 반올림한다 — 차트 헤더의 종가·등락률이 메일 본문과 같은 값에서 나온다.
 * 직전 종가와 난수 상태를 `reduce`로 이어 받는다(봉마다 난수 4개: 등락·윗꼬리·아랫꼬리·거래량).
 */
export function buildSampleBars(symbol: SampleChartSymbol): Bar[] {
    const { start, drift, volatility, seed } = SAMPLE_BAR_SEEDS[symbol];
    return sampleTradingTimes(SAMPLE_BAR_COUNT).reduce<BarWalk>(
        (walk, time) => {
            const open = walk.previousClose;
            const {
                values: [changeDraw, upperDraw, lowerDraw, volumeDraw],
                state,
            } = drawRandoms(walk.rngState, 4);
            const change = drift + (changeDraw! - 0.5) * 2 * volatility;
            const close = round2(open * (1 + change));
            const wick = 1 + upperDraw! * volatility * 0.6;
            const high = round2(Math.max(open, close) * wick);
            const low = round2(
                Math.min(open, close) / (1 + lowerDraw! * volatility * 0.6)
            );
            return {
                bars: [
                    ...walk.bars,
                    {
                        time,
                        open: round2(open),
                        high,
                        low,
                        close,
                        volume: Math.round(1_000_000 + volumeDraw! * 4_000_000),
                    },
                ],
                previousClose: close,
                rngState: state,
            };
        },
        { bars: [], previousClose: start, rngState: seed >>> 0 }
    ).bars;
}

/** 차트 이미지에 겹치는 이동평균 — 라우트가 쓰는 기간과 같고, core 계산기를 그대로 쓴다. */
export function buildSampleChartMa(
    bars: Bar[]
): Record<number, (number | null)[]> {
    return Object.fromEntries(
        REPORT_CHART_MA_PERIODS.map(period => [
            period,
            calculateMA(bars, period),
        ])
    );
}

function briefFromBars(
    symbol: SampleChartSymbol,
    signals: SymbolBrief['signals'],
    trend: SymbolBrief['trend']
): SymbolBrief {
    const bars = buildSampleBars(symbol);
    const last = bars.at(-1)!;
    const previous = bars.at(-2)!;
    return {
        symbol,
        close: last.close,
        changePercent: ((last.close - previous.close) / previous.close) * 100,
        trend,
        signals,
    };
}

const NEWS_PUBLISHED_AT = `${SAMPLE_REPORT_DATE}T06:00:00Z`;
const SAMPLE_SOURCE = 'Sample Wire';
const ANALYZED_AT = '2026-10-13T21:00:00Z';

/** 전체 카드로 싣는 두 종목의 신호 요약. */
function sampleBrief(symbol: SampleChartSymbol): SymbolBrief {
    return symbol === 'NVDA'
        ? briefFromBars(
              'NVDA',
              {
                  score: 78,
                  bullish: [
                      'golden_cross',
                      'macd_bullish_cross',
                      'dmi_bullish_cross',
                      'supertrend_bullish_flip',
                  ],
                  bearish: ['rsi_overbought'],
                  fresh: ['macd_bullish_cross'],
                  pullback: null,
              },
              'uptrend'
          )
        : briefFromBars(
              'AAPL',
              {
                  score: 61,
                  bullish: ['macd_bullish_cross', 'ichimoku_cloud_breakout'],
                  bearish: [],
                  fresh: [],
                  pullback: 'washoutInUptrend',
              },
              'uptrend'
          );
}

/** 요약 표에만 싣는 종목. 봉을 만들지 않으니 값은 상수다. */
const SAMPLE_BRIEFS: readonly SymbolBrief[] = [
    {
        symbol: 'MSFT',
        close: 438.15,
        changePercent: 0.82,
        trend: 'uptrend',
        signals: {
            score: 66,
            bullish: ['golden_cross', 'dmi_bullish_cross'],
            bearish: [],
            fresh: [],
            pullback: null,
        },
    },
    {
        symbol: 'TSLA',
        close: 251.4,
        changePercent: -0.37,
        trend: 'sideways',
        signals: {
            score: null,
            bullish: [],
            bearish: [],
            fresh: [],
            pullback: null,
        },
    },
    {
        symbol: 'AMZN',
        close: 186.9,
        changePercent: -1.54,
        trend: 'downtrend',
        signals: {
            score: 38,
            bullish: [],
            bearish: ['death_cross', 'macd_bearish_cross'],
            fresh: ['macd_bearish_cross'],
            pullback: null,
        },
    },
];

/** 샘플 산문을 읽는 번역자 — `entities.email-report.sample` 네임스페이스. */
export type SampleTextTranslator = (key: string) => string;

/**
 * 뉴스 제목은 로케일과 무관하게 영어 원문으로 둔다. 실제 리포트는 `titleLocalized ?? titleKo ??
 * titleEn` 순으로 고르므로(`buildSymbolReport`) 번역된 제목이 있으면 그걸 싣고, 없으면 영어
 * 원문으로 떨어진다 — 샘플은 그 폴백 모양을 보여 준다(`summary`만 카탈로그의 로케일 문장).
 * 즉 번역 제목이 있는 기사라면 실제 메일에서는 제목도 수신자 언어로 보일 수 있다.
 */
function nvdaReport(text: SampleTextTranslator, newsUrl: string): SymbolReport {
    return {
        symbol: 'NVDA',
        technical: {
            summary: text('nvda.technical'),
            trend: 'bullish',
            patterns: [text('nvda.pattern')],
        },
        plain: text('nvda.plain'),
        news: [
            {
                title: 'Chipmaker raises quarterly outlook on data-center demand',
                summary: text('nvda.newsSummary1'),
                sentiment: 'bullish',
                url: newsUrl,
                source: SAMPLE_SOURCE,
                publishedAt: NEWS_PUBLISHED_AT,
            },
            {
                title: 'Supply constraints ease for AI accelerators',
                summary: text('nvda.newsSummary2'),
                sentiment: 'neutral',
                url: newsUrl,
                source: SAMPLE_SOURCE,
                publishedAt: NEWS_PUBLISHED_AT,
            },
        ],
        options: {
            expirationDate: '2026-10-16',
            putCallRatio: 0.74,
            atmImpliedVolatility: 0.52,
            impliedMovePercent: 6.1,
            summary: text('nvda.options'),
        },
        analyzedAt: ANALYZED_AT,
    };
}

function aaplReport(text: SampleTextTranslator, newsUrl: string): SymbolReport {
    return {
        symbol: 'AAPL',
        technical: {
            summary: text('aapl.technical'),
            trend: 'bullish',
            patterns: [text('aapl.pattern')],
        },
        plain: text('aapl.plain'),
        news: [
            {
                title: 'Device maker outlines product launch schedule',
                summary: text('aapl.newsSummary1'),
                sentiment: 'bullish',
                url: newsUrl,
                source: SAMPLE_SOURCE,
                publishedAt: NEWS_PUBLISHED_AT,
            },
        ],
        options: null,
        analyzedAt: ANALYZED_AT,
    };
}

export interface BuildSampleReportEmailInput {
    locale: Locale;
    t: ReportEmailTranslator;
    signalLabel: SignalLabelResolver;
    sampleText: SampleTextTranslator;
    /**
     * 뉴스 링크 접두. 외부 기사 URL은 `http(s)`만 링크로 걸리므로 절대 주소가 필요하다 —
     * 나머지 링크(종목 페이지·설정)는 사이트 상대 경로다.
     */
    siteUrl: string;
}

/**
 * 샘플 메일의 `buildReportEmail` 입력. 링크는 전부 무해한 곳으로 보낸다 — 종목 페이지,
 * 설정 화면, 이 샘플 페이지. 수신거부 링크는 **실제 수신거부 경로가 아니라** 샘플 페이지를
 * 가리킨다(누르는 사람은 회원이 아니고, 회원이어도 샘플에서 수신이 꺼지면 안 된다).
 */
export function buildSampleReportEmailInput({
    locale,
    t,
    signalLabel,
    sampleText,
    siteUrl,
}: BuildSampleReportEmailInput): BuildReportEmailInput {
    const symbolPage = (symbol: string) =>
        localePath(locale, `/${encodeURIComponent(symbol)}`);
    const newsUrl = (symbol: string) =>
        `${siteUrl}${localePath(locale, `/${symbol}/news`)}`;
    const reports = {
        NVDA: nvdaReport(sampleText, newsUrl('NVDA')),
        AAPL: aaplReport(sampleText, newsUrl('AAPL')),
    } satisfies Record<SampleChartSymbol, SymbolReport>;
    const sections: ReportEmailSection[] = SAMPLE_CHART_SYMBOLS.map(symbol => ({
        report: reports[symbol],
        brief: sampleBrief(symbol),
        chartUrl: sampleChartUrl(symbol),
        pageUrl: symbolPage(symbol),
    }));
    const briefRows: SymbolBriefRow[] = SAMPLE_BRIEFS.map(brief => ({
        brief,
        pageUrl: symbolPage(brief.symbol),
    }));
    const samplePage = localePath(locale, '/email-report/sample');
    return {
        to: '',
        locale,
        localDate: SAMPLE_REPORT_DATE,
        sections,
        briefRows,
        unsubscribePageUrl: samplePage,
        unsubscribeApiUrl: samplePage,
        settingsUrl: localePath(locale, '/email-report'),
        t,
        signalLabel,
    };
}
