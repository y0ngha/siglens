/** Investor Flows 데이터 계층의 내부 도메인 타입(수집·저장용). 화면·분석 계약은 `coreTypes.ts`. */

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
