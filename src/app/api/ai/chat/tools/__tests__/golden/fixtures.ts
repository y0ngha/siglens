import type {
    MonthEndClose,
    OptionsContract,
    OptionsSnapshot,
} from '@y0ngha/siglens-core';
import { guideEntry } from '@/__tests__/fixtures/guideFixtures';
import STORED from '@/entities/analysis-outcome/__tests__/fixtures/storedAnalyses.json';
import type { AnalystViews } from '@/entities/analyst-views/model';
import type {
    CompanyFiling,
    CompanyFilingBody,
} from '@/entities/company-filings/model';
import type { GuideEntry } from '@/entities/guide/types';
import type { XPostItem, XPostsAccount } from '@/entities/x-posts/model';
import type {
    YahooDailyClose,
    YahooMacroQuote,
} from '@/shared/api/yahoo/yahooMacroSource';
import { MS_PER_DAY, MS_PER_HOUR } from '@/shared/config/time';
import { addUtcIsoDays } from '@/shared/lib/isoDate';
import { noise } from './syntheticMarket';

/**
 * 도구별 골든 픽스처. 크기와 모양은 각 도구의 기존 단위 테스트 픽스처(실측 기반)를 따랐고, 값은 합성이다 — 실제 종목·
 * 사용자 데이터를 복사하지 않았다. 가격 같은 숫자는 반올림 단계가 빠지면 드러나도록 소수점이 긴 실측 모양을 쓴다
 * (TESTING.md#TE-15).
 */

const FIRMS = [
    'Morgan Stanley',
    'B of A Securities',
    'Goldman Sachs',
    'JP Morgan',
    'Wells Fargo',
    'Truist Securities',
    'Rosenblatt',
    'Craig-Hallum',
    'Needham',
    'Piper Sandler',
];
const GRADES = [
    'Overweight',
    'Equal-Weight',
    'Market Perform',
    'Buy',
    'Neutral',
];
const ACTIONS = ['upgrade', 'downgrade', 'maintain', 'initiate'] as const;

/** 미국 종목의 애널리스트 뷰 — 변경 이력 `rowCount`건(도구는 15건까지 싣는다), 추정치 4기간. */
export function analystViews(
    symbol: string,
    rowCount: number,
    over: Partial<AnalystViews> = {}
): AnalystViews {
    return {
        asOf: '2026-11-17T12:04:11.000Z',
        symbol,
        targets: {
            yahoo: {
                mean: 268.4372,
                median: 270,
                low: 182.5,
                high: 345,
                analysts: 41,
            },
            fmp: {
                consensus: 259.873333,
                median: 262,
                low: 190,
                high: 330,
                lastMonth: { count: 6, avg: 263.016667 },
                lastQuarter: { count: 19, avg: 251.442105 },
            },
            gapPct: 3.29,
            sourcesDisagree: false,
        },
        ratings: {
            strongBuy: 9,
            buy: 24,
            hold: 11,
            sell: 2,
            strongSell: 1,
            analysts: 47,
            source: 'yahoo',
        },
        actions: {
            available: true,
            rows: Array.from({ length: rowCount }, (_, i) => {
                const action = ACTIONS[i % ACTIONS.length] ?? 'maintain';
                return {
                    date: addUtcIsoDays('2026-11-16', -3 * i),
                    firm: FIRMS[i % FIRMS.length] ?? 'Needham',
                    action,
                    fromGrade: GRADES[i % GRADES.length] ?? 'Neutral',
                    toGrade: GRADES[(i + 2) % GRADES.length] ?? 'Buy',
                    priorTarget: 231.5 + i * 1.25,
                    target: 248.75 + i * 1.5,
                    targetAction:
                        i % 3 === 0 ? ('lower' as const) : ('raise' as const),
                };
            }),
            tally: {
                last30d: {
                    upgrades: 3,
                    downgrades: 2,
                    initiations: 1,
                    targetRaises: 7,
                    targetCuts: 2,
                },
                last90d: {
                    upgrades: 6,
                    downgrades: 5,
                    initiations: 2,
                    targetRaises: 14,
                    targetCuts: 6,
                },
            },
        },
        earnings: {
            date: '2027-01-28',
            isEstimate: true,
            session: null,
            callAt: null,
        },
        estimates: ['0q', '+1q', '0y', '+1y'].map((period, i) => ({
            period,
            endDate:
                ['2026-12-31', '2027-03-31', '2026-12-31', '2027-12-31'][i] ??
                '2027-12-31',
            eps: {
                avg: 2.3471 + i * 0.4183,
                analysts: 31 - i,
                ago7d: 2.3402 + i * 0.4183,
                ago30d: 2.3118 + i * 0.4183,
                ago60d: 2.2894 + i * 0.4183,
                ago90d: 2.2577 + i * 0.4183,
                change30d: 0.0353,
                change90d: 0.0894,
            },
            revisions: { up7d: 3, down7d: 1, up30d: 9, down30d: 4 },
            revenue: {
                avg: 41_278_330_000 + i * 3_118_000_000,
                analysts: 28 - i,
                growthPct: 11.84 + i * 0.73,
            },
        })),
        degraded: [],
        ...over,
    };
}

/** 옵션 체인 — 만기 `expirations`개, 만기마다 행사가 25개(실제 체인의 현재가 근처 구간과 같은 폭). */
export function optionsSnapshot(
    symbol: string,
    underlyingPrice: number,
    capturedAt: string,
    expirations: readonly { date: string; days: number }[]
): OptionsSnapshot {
    const step = underlyingPrice >= 100 ? 5 : 1;
    const atm = Math.round(underlyingPrice / step) * step;
    const strikes = Array.from({ length: 25 }, (_, i) => atm + (i - 12) * step);
    const contract = (
        expiry: { date: string; days: number },
        strike: number,
        side: 'C' | 'P',
        e: number
    ): OptionsContract => {
        const moneyness = (strike - underlyingPrice) / underlyingPrice;
        const iv = 0.31 + 0.9 * moneyness * moneyness + 0.004 * e;
        const intrinsic = Math.max(
            0,
            side === 'C' ? underlyingPrice - strike : strike - underlyingPrice
        );
        const time =
            underlyingPrice *
            iv *
            Math.sqrt(expiry.days / 365) *
            0.4 *
            Math.exp(-Math.abs(moneyness) * 6);
        const mid = Number((intrinsic + time).toFixed(2));
        const spread = Number(Math.max(0.01, mid * 0.035).toFixed(2));
        const k = Math.round(strike * 10) + (side === 'C' ? 0 : 5000) + e * 97;
        return {
            contractSymbol: `${symbol}${expiry.date.replaceAll('-', '').slice(2)}${side}${String(strike * 1000).padStart(8, '0')}`,
            strike,
            lastPrice: mid,
            bid: Math.max(0, Number((mid - spread / 2).toFixed(2))),
            ask: Number((mid + spread / 2).toFixed(2)),
            volume: Math.round(
                1_800 *
                    Math.exp(-Math.abs(moneyness) * 9) *
                    (1 + 0.4 * noise(5, k, 1))
            ),
            openInterest: Math.round(
                12_500 *
                    Math.exp(-Math.abs(moneyness) * 7) *
                    (1 + 0.5 * noise(5, k, 2))
            ),
            impliedVolatility: Number(iv.toFixed(6)),
            inTheMoney: intrinsic > 0,
        };
    };
    return {
        symbol,
        underlyingPrice,
        capturedAt,
        chains: expirations.map((expiry, e) => ({
            expirationDate: expiry.date,
            daysToExpiration: expiry.days,
            calls: strikes.map(strike => contract(expiry, strike, 'C', e)),
            puts: strikes.map(strike => contract(expiry, strike, 'P', e)),
        })),
    };
}

/** 지수 월말 종가 — `firstMonth`부터 `currentMonth`까지(닫힌 식이라 누적이 없다). */
export function monthEnds(
    firstMonth: string,
    currentMonth: string,
    base: number,
    seed: number
): MonthEndClose[] {
    const toIndex = (month: string): number =>
        Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;
    const start = toIndex(firstMonth);
    return Array.from({ length: toIndex(currentMonth) - start + 1 }, (_, i) => {
        const m = start + i;
        const close =
            base *
            1.0062 ** i *
            (1 + 0.07 * Math.sin(i / 9 + seed) + 0.035 * noise(seed, i, 0));
        return {
            month: `${Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}`,
            close: Number(close.toFixed(2)),
        };
    });
}

const MEMBERS = [
    ['Daniel', 'Whitcombe', 'house'],
    ['Maria', 'Okafor', 'senate'],
    ['Jonah', 'Breckridge', 'house'],
    ['Lena', 'Castellano', 'house'],
] as const;
const AMOUNTS = [
    { min: 1_001, max: 15_000, label: '$1,001 - $15,000' },
    { min: 15_001, max: 50_000, label: '$15,001 - $50,000' },
    { min: 100_001, max: 250_000, label: '$100,001 - $250,000' },
] as const;

export function congressTrades(count: number) {
    return Array.from({ length: count }, (_, i) => {
        const [firstName, lastName, chamber] =
            MEMBERS[i % MEMBERS.length] ?? MEMBERS[0];
        const side = i % 3 === 2 ? ('sell' as const) : ('buy' as const);
        const transactionDate = addUtcIsoDays('2026-10-30', -6 * i);
        return {
            chamber,
            firstName,
            lastName,
            office: `${firstName} ${lastName}`,
            district: chamber === 'house' ? 'OH09' : null,
            owner: i % 2 === 0 ? 'self' : 'spouse',
            side,
            rawType: side === 'buy' ? 'Purchase' : 'Sale (Full)',
            amount: AMOUNTS[i % AMOUNTS.length] ?? AMOUNTS[0],
            assetType: 'Stock',
            transactionDate,
            disclosureDate: addUtcIsoDays(transactionDate, 21),
            link: `https://disclosures.example.gov/ptr/${20026100 + i}.pdf`,
            capitalGainsOver200USD: false,
        };
    });
}

const COMPANY_HANDLE = 'goldenrodsys';
const CEO_HANDLE = 'ava_goldenrod';

export function xAccounts(): XPostsAccount[] {
    return [
        {
            handle: COMPANY_HANDLE,
            name: 'Goldenrod Systems',
            role: 'company',
            followers: 1_284_311,
            loaded: true,
            postsInWindow: 9,
            moreInWindow: true,
        },
        {
            handle: CEO_HANDLE,
            name: 'Ava Lindqvist',
            role: 'ceo',
            followers: 402_118,
            loaded: true,
            postsInWindow: 5,
            moreInWindow: false,
        },
    ];
}

/** X 원글 `count`개 — 본문 길이는 `textChars`(최대 600, 줄바꿈·따옴표 포함). */
export function xPosts(count: number, textChars: number): XPostItem[] {
    const sentence =
        'Shipped the "Lumen" controller update to every fab partner today.\nThroughput up again this quarter; details in the deck. ';
    return Array.from({ length: count }, (_, i) => {
        const handle = i % 3 === 2 ? CEO_HANDLE : COMPANY_HANDLE;
        const text =
            `${i + 1}. ${sentence.repeat(Math.ceil(textChars / sentence.length))}`.slice(
                0,
                textChars
            );
        return {
            handle,
            role:
                handle === CEO_HANDLE ? ('ceo' as const) : ('company' as const),
            postedAt: new Date(
                Date.UTC(2026, 10, 17, 21) - i * 9 * MS_PER_HOUR
            ).toISOString(),
            text,
            truncated: textChars >= 600,
            url: `https://x.com/${handle}/status/19${String(8_812_345_678_901_234 + i * 7_919)}`,
            likes: 14_200 - i * 913,
            reposts: 2_310 - i * 147,
        };
    });
}

const ITEM_LABELS = [
    { code: '2.02', label: 'Results of Operations and Financial Condition' },
    { code: '9.01', label: 'Financial Statements and Exhibits' },
    { code: '5.02', label: 'Departure of Directors or Certain Officers' },
    { code: '8.01', label: 'Other Events' },
    { code: '7.01', label: 'Regulation FD Disclosure' },
];

export function companyFilings(count: number): CompanyFiling[] {
    return Array.from({ length: count }, (_, i) => {
        const accession = `0001193125-26-${String(461_016 - i * 3_113).padStart(6, '0')}`;
        return {
            accession,
            form: i === 3 ? ('8-K/A' as const) : ('8-K' as const),
            filedAt: addUtcIsoDays('2026-11-12', -11 * i),
            items: [
                ITEM_LABELS[i % ITEM_LABELS.length] ?? ITEM_LABELS[0],
                ITEM_LABELS[1] ?? ITEM_LABELS[0],
            ],
            headline:
                i % 2 === 0
                    ? `Goldenrod Systems Reports ${['Third', 'Second', 'First', 'Fourth'][i % 4]} Quarter Results`
                    : null,
            hasPressRelease: i % 2 === 0,
            url: `https://www.sec.gov/Archives/edgar/data/1990001/${accession.replaceAll('-', '')}/gldnx-8k.htm`,
        };
    });
}

/** 보도자료 본문 — `paragraphs`개 문단(문단마다 약 640자, 표 머리글·숫자 포함). */
export function filingBody(
    filing: CompanyFiling,
    paragraphs: number
): CompanyFilingBody {
    const paragraph = (i: number): string =>
        `Section ${i + 1}. Revenue for the period was $${(4_812.7 + i * 37.3).toFixed(1)} million, up ${(11.4 + i * 0.3).toFixed(1)}% year over year, as "Lumen" controller shipments rose in every region. Gross margin was ${(46.2 - i * 0.1).toFixed(1)}%, compared with 44.9% a year earlier; operating expenses were $${(1_204.5 + i * 8.1).toFixed(1)} million.\nThe company expects next-quarter revenue of $5.0 billion to $5.2 billion and reiterated its full-year outlook. Management will discuss the results on a conference call; a replay and the slide deck are posted on the investor relations site. Forward-looking statements are subject to risks described in the annual report.`;
    const text = Array.from({ length: paragraphs }, (_, i) =>
        paragraph(i)
    ).join('\n\n');
    return {
        ...filing,
        document: 'press_release',
        text,
        truncated: false,
        totalChars: text.length,
    };
}

/** 긴 가이드 본문 — 문단 `paragraphs`개(문단마다 약 300자). 3,500자 컷을 넘기면 문단 경계에서 잘린다. */
function longGuideBody(topic: string, paragraphs: number): string {
    return Array.from(
        { length: paragraphs },
        (_, i) =>
            `## ${topic} ${i + 1}단계\n\n${topic}는 최근 ${14 + i}개 봉의 상승폭과 하락폭을 비교해 0~100 사이 값으로 나타내요. 70을 넘으면 단기 과열, 30 아래면 침체로 읽는 경우가 많지만, 강한 추세에서는 과열 구간이 오래 이어질 수 있어요. "다이버전스"는 가격이 새 고점을 만들 때 지표가 따라오지 못하는 모습이에요. 신호 하나만으로 판단하지 말고 거래량과 추세선을 함께 보세요.`
    ).join('\n\n');
}

export function guideCatalog(): { entries: GuideEntry[] } {
    return {
        entries: [
            guideEntry({
                slug: 'rsi',
                title: 'RSI',
                aliases: ['상대강도지수', 'relative strength index'],
                summary:
                    '최근 상승폭과 하락폭으로 과열과 침체를 재는 지표예요.',
                bodyMd: longGuideBody('RSI', 16),
                related: ['macd', 'stochastic'],
            }),
            guideEntry({
                slug: 'macd',
                title: 'MACD',
                order: 2,
                aliases: ['이동평균 수렴확산'],
                summary: '두 이동평균의 간격으로 추세의 힘을 보는 지표예요.',
                bodyMd: longGuideBody('MACD', 4),
            }),
            guideEntry({
                slug: 'stochastic',
                title: '스토캐스틱',
                order: 3,
                aliases: ['stochastic'],
                summary: '최근 범위 안에서 종가의 위치를 보는 지표예요.',
                bodyMd: longGuideBody('스토캐스틱', 3),
            }),
            guideEntry({
                slug: 'doji',
                category: 'candlesticks',
                title: '도지',
                aliases: ['doji'],
                summary: '시가와 종가가 거의 같은 캔들이에요.',
                bodyMd: longGuideBody('도지', 2),
            }),
            guideEntry({
                slug: 'rsi-how-to-read',
                category: 'howto',
                title: 'RSI 보는 법',
                summary: 'RSI 숫자를 실제 차트에서 읽는 순서예요.',
                about: ['rsi'],
                bodyMd: longGuideBody('RSI 읽기', 5),
                isFallback: true,
            }),
        ],
    };
}

/** Yahoo 선물·환율 시세. */
export function macroQuote(
    over: Partial<YahooMacroQuote> & { price: number }
): YahooMacroQuote {
    return {
        name: null,
        changePct: null,
        currency: 'USD',
        delayMinutes: 10,
        timeIso: '2026-11-18T15:20:00.000Z',
        quoteType: 'FUTURE',
        contractExpiryIso: null,
        ...over,
    };
}

/** 거래소 현지 일봉 종가 400일(최근이 마지막) — 52주 범위와 기간 변화율을 낼 만큼. */
export function macroDaily(
    endDate: string,
    base: number,
    seed: number
): YahooDailyClose[] {
    return Array.from({ length: 400 }, (_, k) => {
        const i = 399 - k;
        const date = new Date(
            Date.parse(`${endDate}T00:00:00Z`) - i * MS_PER_DAY
        )
            .toISOString()
            .slice(0, 10);
        const close =
            base *
            (1 + 0.11 * Math.sin(k / 41 + seed) + 0.02 * noise(seed, k, 0));
        return {
            date,
            close: Number(close.toFixed(4)),
            high: Number((close * 1.006).toFixed(4)),
            low: Number((close * 0.994).toFixed(4)),
        };
    }).filter(row => {
        const weekday = new Date(`${row.date}T00:00:00Z`).getUTCDay();
        return weekday !== 0 && weekday !== 6;
    });
}

/**
 * 저장된 실제 기술 분석 두 건(`storedAnalyses.json` — 공개 백테스트 실행의 core 정규화 결과, 사용자 데이터 없음).
 * 분석 도구(`get_cached_analysis`·`run_fresh_analysis`·`propose_price_alert`)의 운영 모양 픽스처로 쓴다. 가격대는
 * 약 240달러라 합성 종목 `GLDNX`의 가격대와 맞췄다.
 */
export function storedTechnicalAnalysis(
    which: 0 | 1,
    analyzedAt: string
): Record<string, unknown> {
    const entry = Object.values(STORED.analyses)[which];
    return { ...entry?.result, analyzedAt };
}

export const PORTFOLIO_ROWS = [
    {
        symbol: 'GLDNX',
        companyName: 'Goldenrod Systems Inc.',
        quantity: '37.5',
        averagePrice: '198.42371',
        fmpSymbol: null,
    },
    {
        symbol: 'QRTZ',
        companyName: 'Quartzline Holdings',
        quantity: '120',
        averagePrice: '161.0825',
        fmpSymbol: null,
    },
    {
        symbol: 'VLMR',
        companyName: 'Velmora Therapeutics',
        quantity: '410',
        averagePrice: '13.9',
        fmpSymbol: null,
    },
    {
        symbol: '900110.KS',
        companyName: '한빛정밀',
        quantity: '15',
        averagePrice: '98250',
        fmpSymbol: null,
    },
    {
        symbol: '900220.KQ',
        companyName: '다온바이오',
        quantity: '230',
        averagePrice: '24120',
        fmpSymbol: null,
    },
].map((row, i) => ({
    id: `00000000-0000-4000-8000-0000000001${String(i).padStart(2, '0')}`,
    userId: '6f1d2c3b-4a59-4e7d-9c10-2b3a4c5d6e7f',
    createdAt: new Date(Date.UTC(2026, 3, 2 + i * 9)),
    updatedAt: new Date(Date.UTC(2026, 9, 1 + i)),
    ...row,
}));

/** 종합 분석 응답 — 섹션마다 운영 길이의 한국어 불릿. */
export function overallAnalysis(analyzedAt: string): Record<string, unknown> {
    const bullets = (topic: string, n: number): string[] =>
        Array.from(
            { length: n },
            (_, i) =>
                `${topic} ${i + 1}: 최근 20거래일 동안 거래량이 평균 대비 ${(1.12 + i * 0.07).toFixed(2)}배로 늘었고, 240달러 부근 지지가 ${i + 2}차례 확인됐습니다.`
        );
    return {
        headlineKo: '기술적 반등과 실적 기대가 맞물린 구간입니다.',
        technicalBulletsKo: bullets('기술', 4),
        fundamentalBulletsKo: bullets('펀더멘털', 3),
        newsBulletsKo: bullets('뉴스', 3),
        optionsBulletsKo: bullets('옵션', 2),
        financialsBulletsKo: bullets('재무', 3),
        investorFlowsBulletsKo: bullets('수급', 2),
        integratedConclusionKo:
            '단기 과열 신호가 일부 보이지만 중기 추세는 유지되고 있습니다. 248~250달러 저항 돌파 여부와 240달러 지지를 함께 확인하세요.',
        scenarios: [
            {
                name: 'bullish',
                triggerConditionKo: '250달러 돌파 후 안착',
                priceRangeKo: '255~268달러',
            },
            {
                name: 'neutral',
                triggerConditionKo: '240~250달러 박스권 유지',
                priceRangeKo: '240~250달러',
            },
            {
                name: 'bearish',
                triggerConditionKo: '240달러 이탈',
                priceRangeKo: '228~236달러',
            },
        ],
        riskFactorsKo: bullets('위험', 3),
        analyzedAt,
    };
}
