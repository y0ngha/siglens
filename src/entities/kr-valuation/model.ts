import type { DartPeriodicReportCode } from '@/shared/api/dart/dartClient';

/**
 * 한국 종목 PER·PBR 밸류에이션 모델.
 *
 * 값의 출처는 둘뿐이다. `dart`는 DART 정기보고서(연결, 연결이 없으면 별도)의 지배주주 순이익·자본으로 계산한 값이고,
 * `provider`는 DART를 쓸 수 없을 때(키 없음·보고서 없음·12월 결산이 아님·DART 오류) 데이터 제공처(yahoo)가 준 값 그대로다.
 * 어느 쪽이든 `basis`가 무엇을 어떤 기준으로 계산했는지 말하므로 화면·AI 입력·에이전트가 같은 말을 한다.
 */

type KrValuationSource = 'dart' | 'provider';

/** DART 재무제표 구분 — 연결을 우선하고, 연결 재무제표를 내지 않는 회사만 별도를 쓴다. */
type KrStatements = 'consolidated' | 'separate';

/**
 * 주당 지표의 분모가 된 주식수.
 * - `issued_incl_treasury`: 보통주+우선주 **발행주식 총수**(자기주식 포함). EPS 기준 — 네이버(FnGuide)의 EPS가 이 분모다.
 * - `outstanding_ex_treasury`: 보통주+우선주 발행주식에서 자기주식을 뺀 **유통주식수**. BPS 기준 — 네이버의 BPS가 이 분모다.
 * - `provider_implied`: yahoo가 시가총액에서 거꾸로 낸 주식수(DART를 못 쓴 경우).
 */
type KrEpsShares = 'issued_incl_treasury' | 'provider_implied';
type KrBpsShares = 'outstanding_ex_treasury' | 'provider_implied';

export interface KrValuationBasis {
    source: KrValuationSource;
    /** `provider`면 null. */
    statements: KrStatements | null;
    /** TTM 순이익 합의 마지막 기간 말(`YYYY-MM-DD`). `provider`거나 순이익을 못 구했으면 null. */
    ttmEnd: string | null;
    /** 자본(BPS 분자)의 기준일(`YYYY-MM-DD`). */
    equityAsOf: string | null;
    epsShares: KrEpsShares;
    bpsShares: KrBpsShares;
    /** 주식수를 읽은 보고서의 결산일(`YYYY-MM-DD`). 분기보고서는 주식수 표를 싣지 않아 `equityAsOf`보다 앞설 수 있다. */
    sharesAsOf: string | null;
    /** PER·PBR 분자로 쓴 종가의 날짜. 가격을 못 구했으면 null. */
    priceDate: string | null;
    /** 사람이 읽는 기준 설명 한 문장(영어, 모델에 그대로 전달). */
    note: string;
}

export interface KrValuation {
    pe: number | null;
    pb: number | null;
    /** 주당순이익(원). TTM 지배주주 순이익 ÷ 발행주식 총수. */
    epsTtm: number | null;
    /** 주당순자산(원). 지배주주 자본 ÷ 유통주식수. */
    bps: number | null;
    /** PER·PBR이 null인 이유. 값이 있으면 키가 없다. */
    nullReason: {
        pe?: 'loss' | 'missing';
        pb?: 'negative_equity' | 'missing';
    };
    basis: KrValuationBasis;
}

/** `provider` 기준으로 내려온 이유. 설명 문구와 로그에 쓴다. */
export type KrProviderFallbackReason =
    | 'dart_unavailable'
    | 'not_covered'
    | 'no_report'
    | 'non_december_fiscal_year'
    | 'incomplete_report'
    | 'price_unavailable';

/** 가격 하나와 그 날짜. 날짜를 모르면 null. */
export interface KrPrice {
    close: number;
    date: string | null;
}

/** 데이터 제공처(yahoo)가 이미 계산해 둔 값 — DART를 못 쓸 때의 대체값이자 DART 값과의 대조용. */
export interface KrProviderValues {
    pe: number | null;
    pb: number | null;
    epsTtm: number | null;
}

/** DART 정기보고서 코드(1분기 `11013`, 반기 `11012`, 3분기 `11014`, 사업보고서 `11011`) — 클라이언트의 유니온을 그대로 쓴다. */
export type KrReportCode = DartPeriodicReportCode;

/** 한 보고서에서 읽은 순이익·자본. DART 응답 전체가 아니라 계산에 쓰는 숫자만 남겨 캐시를 작게 둔다. */
export interface StatementFigures {
    year: number;
    reportCode: KrReportCode;
    fsDiv: 'CFS' | 'OFS';
    /** 당기 누적 순이익(원). 사업보고서는 한 해 전체, 1분기 보고서는 3개월(= 누적). 못 읽으면 null. */
    netIncomeYtd: number | null;
    /** 전년 동기 누적 순이익(원). */
    netIncomePriorYtd: number | null;
    /** 당기말 자본(원). 연결이면 지배주주지분. */
    equity: number | null;
}

/** 주식의 총수 현황(합계 = 보통주 + 우선주). */
export interface ShareTotals {
    /** 발행주식 총수(자기주식 포함). */
    issued: number;
    /** 자기주식수. */
    treasury: number;
    /** 유통주식수(발행주식 총수 − 자기주식). */
    outstanding: number;
    /** 보고서 결산일(`YYYY-MM-DD`). 모르면 null. */
    settledOn: string | null;
}
