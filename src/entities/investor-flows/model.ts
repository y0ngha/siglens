/** Investor Flows 데이터 계층의 내부 도메인 타입(수집·저장용). 화면·분석 계약은 `@y0ngha/siglens-core`. */

/** 13F 정정 종류. `13F-HR/A`의 `amendmentInfo/amendmentType`. */
export type AmendmentType = 'RESTATEMENT' | 'NEW HOLDINGS';

/** daily form index에서 뽑은 13F 제출 한 건. */
export interface Sec13fIndexEntry {
    /** `13F-HR` 또는 `13F-HR/A`. */
    formType: '13F-HR' | '13F-HR/A';
    companyName: string;
    /** 10자리 0 패딩 CIK. */
    cik: string;
    /** `YYYY-MM-DD`. */
    filingDate: string;
    /** 대시 포함 accession number(`0001234567-26-000001`). */
    accession: string;
}

/** primary_doc.xml에서 읽은 제출 메타. */
export interface Sec13fFilingMeta {
    submissionType: string;
    /** `YYYY-MM-DD`(`periodOfReport`). 읽지 못하면 null. */
    period: string | null;
    isAmendment: boolean;
    amendmentType: AmendmentType | null;
    filerName: string | null;
    /** `13F HOLDINGS REPORT` / `13F NOTICE` / `13F COMBINATION REPORT`. */
    reportType: string | null;
}

/** 유니버스 종목에 대한 한 기관의 한 분기 포지션(같은 CUSIP은 합산됨). */
export interface PositionRow {
    cusip: string;
    shares: number;
    valueUsd: number;
}

/** 저장소의 13F 제출 기록. */
export interface FilingRecord {
    accession: string;
    cik: string;
    period: string | null;
    filingDate: string;
    submissionType: string;
    amendmentType: AmendmentType | null;
    attempts: number;
    processedAt: Date | null;
}

/** 정정 규칙이 정한 포지션 반영 방식. */
export type PositionApplyMode = 'replace' | 'merge' | 'skip';

/** FINRA 일별 공매도 거래량 한 행(우리 심볼 기준). */
export interface ShortVolumeRow {
    symbol: string;
    tradeDate: string;
    shortVolume: number;
    totalVolume: number;
}

/** FINRA 공매도 잔고 한 행(우리 심볼 기준). */
export interface ShortInterestRow {
    symbol: string;
    settlementDate: string;
    shortQty: number;
    prevShortQty: number | null;
    avgDailyVolume: number | null;
    daysToCover: number | null;
}

export interface PreviousSettlementChange {
    /** 비교 대상인 직전 결제일. */
    readonly previousDate: string;
    /** 최신 결제일 잔고 - 직전 결제일 잔고(주). */
    readonly sharesChange: number;
    /** 직전 잔고 대비 변화율(%). 직전 잔고가 0이면 `null`. */
    readonly pct: number | null;
}

/**
 * 수집 파이프라인 한 갈래의 준비 상태. `collecting` = 초기 수집이 아직 끝나지 않았다(그 구간의 빈 데이터는 "이 종목에
 * 데이터가 없다"가 아니다). `unknown` = 상태를 읽지 못했거나 해당 없음(FINRA 꺼짐) — 화면은 예전 동작(빈 상태)으로 돌아간다.
 */
export type PipelineStatus = 'ready' | 'collecting' | 'unknown';

/** 종목과 무관한 수집 파이프라인 준비 상태 — 13F(기관)와 FINRA(공매도). 내부자·13D/G·유통주식은 FMP 라이브라 해당 없다. */
export interface InvestorFlowsPipelineReadiness {
    readonly institutional: PipelineStatus;
    readonly short: PipelineStatus;
}
