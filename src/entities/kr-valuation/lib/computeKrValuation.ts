import type {
    KrPrice,
    KrProviderFallbackReason,
    KrProviderValues,
    KrValuation,
    ShareTotals,
    StatementFigures,
} from '../model';
import { reportPeriodEnd } from './krReportCandidates';

/**
 * 한국 종목 PER·PBR — DART 정기보고서의 지배주주 순이익·자본과 주식수로 계산한다(순수 함수, 반올림 없음 — 표시 쪽이 자른다).
 *
 * **기준(네이버 증권·FnGuide가 표시하는 EPS·BPS의 분모와 같다)**:
 * - EPS = 최근 4분기 지배주주 순이익 ÷ **발행주식 총수**(보통주+우선주, **자기주식 포함**). 삼성카드는 620,770백만 ÷ 115,858,891 = 5,358원으로
 *   네이버 EPS와 같고, 유통주식수로 나누면 8.6% 어긋난다. SK가스·한국앤컴퍼니 등 자기주식이 있는 종목도 같은 방향이다.
 * - BPS = 최신 보고서 지배주주 자본 ÷ **유통주식수**(발행 − 자기주식, 보통주+우선주). 삼성카드 8,904,529백만 ÷ 106,710,695 = 83,446원으로
 *   네이버 BPS와 같고 발행주식수로 나누면 8% 어긋난다. 보통주만 쓰면 우선주 발행사(삼성전자·현대차)가 13~30% 어긋난다.
 * - PER = 종가 ÷ EPS, PBR = 종가 ÷ BPS.
 *
 * TTM: 사업보고서면 그 해 순이익. 분기·반기 보고서면 `당기 누적 + 직전 사업연도 − 전년 동기 누적`. 12월 결산 법인만 다룬다(호출부가
 * 거른다).
 */

export interface KrValuationData {
    /** 가장 최근에 공시된 정기보고서에서 읽은 숫자. */
    current: StatementFigures;
    /** 직전 사업연도 사업보고서(`current`가 사업보고서면 필요 없다). */
    priorAnnual: StatementFigures | null;
    shares: ShareTotals | null;
    price: KrPrice | null;
}

const isPositive = (value: number | null): value is number =>
    value !== null && Number.isFinite(value) && value > 0;

/** TTM 지배주주 순이익. 하나라도 비면 null. */
function trailingFourQuarterNetIncome(
    current: StatementFigures,
    priorAnnual: StatementFigures | null
): number | null {
    if (current.reportCode === '11011') return current.netIncomeYtd;
    if (
        current.netIncomeYtd === null ||
        current.netIncomePriorYtd === null ||
        priorAnnual === null ||
        priorAnnual.reportCode !== '11011' ||
        priorAnnual.year !== current.year - 1 ||
        priorAnnual.netIncomeYtd === null
    )
        return null;
    return (
        current.netIncomeYtd +
        priorAnnual.netIncomeYtd -
        current.netIncomePriorYtd
    );
}

const ratio = (numerator: number | null, denominator: number | null) =>
    numerator === null || denominator === null || denominator === 0
        ? null
        : numerator / denominator;

function describeDartBasis(args: {
    statements: 'consolidated' | 'separate';
    ttmEnd: string | null;
    equityAsOf: string;
    priceDate: string | null;
}): string {
    const { statements, ttmEnd, equityAsOf, priceDate } = args;
    const scope =
        statements === 'consolidated'
            ? 'DART consolidated controlling-interest'
            : 'DART separate-statement';
    const close =
        priceDate === null ? 'the latest close' : `the ${priceDate} close`;
    const eps =
        ttmEnd === null
            ? 'P/E is unavailable because the trailing-4-quarter net income could not be built from the filings'
            : `P/E = ${close} / trailing-4-quarter ${scope} EPS to ${ttmEnd} (net income per issued share, common and preferred, treasury shares included)`;
    return `${eps}; P/B = ${close} / ${scope} equity at ${equityAsOf} per outstanding share (common and preferred, treasury shares excluded).`;
}

/**
 * DART 숫자 → `KrValuation`. 순이익과 자본을 둘 다 못 읽었으면 null(호출부가 제공처 값으로 돌린다).
 */
export function computeKrValuation(data: KrValuationData): KrValuation | null {
    const { current, priorAnnual, shares, price } = data;
    const netIncome = trailingFourQuarterNetIncome(current, priorAnnual);
    if (netIncome === null && current.equity === null) return null;

    const epsTtm = ratio(netIncome, shares?.issued ?? null);
    const bps = ratio(current.equity, shares?.outstanding ?? null);
    const close =
        price !== null && isPositive(price.close) ? price.close : null;
    const equityAsOf = reportPeriodEnd(current.year, current.reportCode);
    const ttmEnd = netIncome === null ? null : equityAsOf;
    const statements =
        current.fsDiv === 'CFS'
            ? ('consolidated' as const)
            : ('separate' as const);
    const priceDate = close === null ? null : (price?.date ?? null);

    const peMissing = epsTtm === null || close === null;
    const pbMissing = bps === null || close === null;
    return {
        pe: !peMissing && epsTtm > 0 ? close / epsTtm : null,
        pb: !pbMissing && bps > 0 ? close / bps : null,
        epsTtm,
        bps,
        nullReason: {
            ...(peMissing
                ? { pe: 'missing' as const }
                : epsTtm <= 0
                  ? { pe: 'loss' as const }
                  : {}),
            ...(pbMissing
                ? { pb: 'missing' as const }
                : bps <= 0
                  ? { pb: 'negative_equity' as const }
                  : {}),
        },
        basis: {
            source: 'dart',
            statements,
            ttmEnd,
            equityAsOf,
            epsShares: 'issued_incl_treasury',
            bpsShares: 'outstanding_ex_treasury',
            sharesAsOf: shares?.settledOn ?? null,
            priceDate,
            note: describeDartBasis({
                statements,
                ttmEnd,
                equityAsOf,
                priceDate,
            }),
        },
    };
}

const PROVIDER_NOTE: Record<KrProviderFallbackReason, string> = {
    dart_unavailable:
        'DART could not be read, so P/E and P/B are the data provider values (trailing four quarters, provider-implied share count).',
    not_covered:
        'The company has no DART corporation code, so P/E and P/B are the data provider values (trailing four quarters, provider-implied share count).',
    no_report:
        'No DART periodic report was found, so P/E and P/B are the data provider values (trailing four quarters, provider-implied share count).',
    non_december_fiscal_year:
        'The fiscal year does not end in December, which the DART calculation does not cover, so P/E and P/B are the data provider values (trailing four quarters, provider-implied share count).',
    price_unavailable:
        'The last close was unavailable, so P/E and P/B are the data provider values (trailing four quarters, provider-implied share count).',
    incomplete_report:
        'The DART report lacks the figures needed, so P/E and P/B are the data provider values (trailing four quarters, provider-implied share count).',
};

/** DART를 못 쓸 때의 값 — 제공처 값을 **다시 곱하지 않고** 그대로 두고 기준만 밝힌다. */
export function providerKrValuation(
    provider: KrProviderValues,
    reason: KrProviderFallbackReason
): KrValuation {
    const { pe, pb, epsTtm } = provider;
    return {
        pe,
        pb,
        epsTtm,
        bps: null,
        nullReason: {
            ...(pe === null
                ? {
                      pe:
                          epsTtm !== null && epsTtm <= 0
                              ? ('loss' as const)
                              : ('missing' as const),
                  }
                : {}),
            ...(pb === null ? { pb: 'missing' as const } : {}),
        },
        basis: {
            source: 'provider',
            statements: null,
            ttmEnd: null,
            equityAsOf: null,
            epsShares: 'provider_implied',
            bpsShares: 'provider_implied',
            sharesAsOf: null,
            priceDate: null,
            note: PROVIDER_NOTE[reason],
        },
    };
}
