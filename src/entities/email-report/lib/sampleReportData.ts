import { localePath, type Locale } from '@/shared/i18n/locales';
import type { SymbolBrief, SymbolReport } from '../reportModel';
import type {
    BuildReportEmailInput,
    ReportEmailSection,
    ReportEmailTranslator,
    SignalLabelResolver,
    SymbolBriefRow,
} from '../templates/reportEmailTypes';
import {
    buildSampleBars,
    SAMPLE_CHART_SYMBOLS,
    SAMPLE_REPORT_DATE,
    type SampleChartSymbol,
} from './sampleBars';

/**
 * 비회원에게 보여 주는 "메일이 이렇게 온다" 샘플의 고정 데이터.
 *
 * 실제 메일과 **같은 렌더 경로**(`buildReportEmail`)를 타도록 `SymbolReport`·`SymbolBrief`
 * 모양 그대로 만든다 — 손으로 줄인 모양을 쓰면 템플릿이 바뀔 때 샘플만 조용히 갈라진다.
 * 시장 데이터 조회는 하지 않는다: 봉은 여기서 결정적으로 만들고, 산문은 번역 카탈로그
 * (`entities.email-report.sample`)에서 온다. 화면의 수치와 문장은 전부 예시다.
 */

/** 샘플 차트 이미지 라우트의 경로 접두. 메일 속 `<img>`가 `/<심볼>`을 붙여 부른다. */
export const SAMPLE_CHART_PATH = '/api/email-report/sample-chart';

/** 샘플 차트 이미지 URL. 사이트 상대 경로라 어느 환경에서 열어도 같은 배포의 이미지를 받는다. */
export function sampleChartUrl(symbol: SampleChartSymbol): string {
    return `${SAMPLE_CHART_PATH}/${symbol}`;
}

function briefFromBars(
    symbol: SampleChartSymbol,
    signals: SymbolBrief['signals'],
    trend: SymbolBrief['trend']
): SymbolBrief {
    const [previous, last] = buildSampleBars(symbol).slice(-2);
    if (previous === undefined || last === undefined) {
        throw new Error(`sample bars for ${symbol} have fewer than two bars`);
    }
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
