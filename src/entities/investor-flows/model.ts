/** Investor Flows 데이터 계층의 내부 도메인 타입(수집·저장용). 화면·분석 계약은 `@y0ngha/siglens-core`. */
import type { InvestorFlowsSnapshot, ProposedSale } from '@y0ngha/siglens-core';

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

/**
 * 종목과 무관한 수집 파이프라인 준비 상태 — 13F(기관)·FINRA(공매도)·SEC FTD·SEC 공시(Form 144·증자)·Reg SHO 과열 목록·DART.
 * 내부자(Form 4)·13D/G·유통주식은 FMP 라이브라 해당 없다.
 */
export interface InvestorFlowsPipelineReadiness {
    readonly institutional: PipelineStatus;
    readonly short: PipelineStatus;
    /** SEC 결제 불이행(FTD) 반월 파일 — 하나라도 저장됐으면 `ready`. */
    readonly failsToDeliver: PipelineStatus;
    /** SEC Form 144·증자 공시(`sec-13f` 실행 안의 공시 단계) — 커서가 최근 며칠까지 따라잡았으면 `ready`. */
    readonly filings: PipelineStatus;
    /** Reg SHO 과열 목록 — 플래그가 꺼져 있으면 `unknown`(해당 없음). */
    readonly thresholdList: PipelineStatus;
    /**
     * 한국 DART 지분공시 — 초기 백필 표식(`dart_backfill_done`)이 있으면 `ready`. `DART_API_KEY`가 없으면 `unknown`(수집이 돌지
     * 않으므로 "수집 중"이라고 말하지 않는다 — 화면은 "데이터 없음"). **한국 종목은 이 갈래만 본다** — 13F·FINRA·SEC 갈래가
     * 수집 중이어도 한국 탭에 "수집 중"이 뜨지 않는다(설계 §4.5).
     */
    readonly dart: PipelineStatus;
}

/**
 * 스냅샷에서 FMP **일시 오류**(429·5xx·네트워크·timeout)로 이번에만 비운 부분 — `largeHolders`(13D/G → `null`), `float`(유통주식수
 * → `null`). "이 종목에 데이터가 없다"가 아니라 "지금 못 불러왔다"이므로 화면은 "일시적으로 불러오지 못했어요"라고, 도구는 "지금은
 * 조회 불가"라고 말한다. 일시 오류가 아닌 실패(402 등)는 다시 해도 같으므로 여기 넣지 않는다.
 */
export type InvestorFlowsDegradedPart = 'largeHolders' | 'float';

/**
 * siglens가 읽는 수급 스냅샷 — core 계약(`InvestorFlowsSnapshot`)에 일시 degrade 표식을 더했다. core 함수에 그대로 넘겨도 된다
 * (구조적 하위 타입). 표식이 없거나 비어 있으면 온전한 스냅샷이다.
 */
export type InvestorFlowsSnapshotWithStatus = InvestorFlowsSnapshot & {
    readonly degraded?: readonly InvestorFlowsDegradedPart[];
};

// ── 수급 확장(SEC FTD·Form 144·증자 공시·13F 옵션·Reg SHO) — 수집·저장용 내부 타입 ────────────────────────
// 화면·분석 계약(`FailsToDeliverPoint` 등)은 `@y0ngha/siglens-core`가 정의한다. 아래 읽기 모델(`…Record`)은 저장소가
// 돌려주는 행 그대로이고, 스냅샷 조립 단계가 core 타입으로 옮긴다.

/** 13F 옵션 행의 종류(`putCall`을 소문자로). */
export type PutCall = 'put' | 'call';

/** 한 기관의 한 분기 옵션 포지션(같은 CUSIP·종류는 합산). `shares`는 기초자산 주식 수, `valueUsd`는 기초자산 명목금액. */
export interface OptionPositionRow {
    cusip: string;
    putCall: PutCall;
    shares: number;
    valueUsd: number;
}

/** information table 하나에서 모은 유니버스 행 — 주식 포지션과 옵션 포지션. */
export interface FilingPositions {
    rows: PositionRow[];
    optionRows: OptionPositionRow[];
}

/** FTD 파일 한 행(파일 표기 그대로 — 심볼은 붙여 쓴 형태라 보조로만 쓴다). */
export interface FtdFileRow {
    /** `YYYY-MM-DD`. */
    settlementDate: string;
    cusip: string;
    /** 파일의 SYMBOL(`BRKB`). 비어 있으면 null. */
    fileSymbol: string | null;
    failsQty: number;
    /** 가격이 `.`(없음)이면 null. */
    price: number | null;
}

/** FTD 파일 끝의 trailer 두 줄(`Trailer record count N`, `Trailer total quantity of shares N`). */
export interface FtdTrailer {
    recordCount: number;
    totalQuantity: number;
}

export interface ParsedFtdFile {
    rows: FtdFileRow[];
    /** trailer가 없으면 null(잘린 파일). */
    trailer: FtdTrailer | null;
    /** 열 수·날짜·수량이 깨져 버린 데이터 행 수(trailer 대조에서 함께 센다). */
    malformedLines: number;
    /** 깨진 행까지 포함해 파일에 있던 데이터 행 수. */
    dataLines: number;
    /** 파싱된 행의 실패 수량 합계. */
    parsedQuantity: number;
}

/** FTD 목록 페이지에서 뽑은 반월 파일 하나. `fileKey` = `YYYYMMa|b`. */
export interface FtdFileLink {
    fileKey: string;
    /** `www.sec.gov` 기준 경로(`/files/...zip`). */
    path: string;
}

/** `sec_ftd_files`의 파일 하나 상태. */
export interface FtdFileState {
    /** 행이 저장됐다(`processed_at IS NOT NULL`). */
    processed: boolean;
    /** 저장하지 못한 시도 횟수(trailer 불일치·깨진 zip·링크 대상 없음). */
    attempts: number;
}

/** 저장되는 FTD 행(우리 심볼로 해석된 유니버스 CUSIP만). */
export interface FtdRow {
    cusip: string;
    settlementDate: string;
    symbol: string;
    failsQty: number;
    price: number | null;
}

/** daily form index 한 줄(임의 양식). */
export interface SecFormIndexEntry {
    formType: string;
    companyName: string;
    /** 10자리 0 패딩 CIK. */
    cik: string;
    /** `YYYY-MM-DD`. */
    filingDate: string;
    /** 대시 포함 accession number. */
    accession: string;
}

/** 증자·희석 공시 종류. */
export type OfferingKind =
    | 'shelf'
    | 'registration'
    | 'prospectus'
    | 'atm'
    | 'underwritten'
    | 'best_efforts'
    | 'private_placement'
    | 'other';

/** 저장되는 증자 공시 한 행((accession, 우리 심볼)마다). */
export interface OfferingFilingRow {
    accession: string;
    symbol: string;
    issuerCik: number;
    formType: string;
    filingDate: string;
    kind: OfferingKind;
    url: string;
}

/** Form 144 `primary_doc.xml`에서 읽은 내용. */
export interface Form144Document {
    issuerCik: string;
    issuerName: string | null;
    filerName: string;
    /** 신고자 CIK(10자리 0 패딩, `headerData/filerInfo/filer/filerCredentials/cik`). 없으면 null. */
    filerCik: string | null;
    relationships: string[];
    securityClass: string;
    /** 매도 예정 수량(여러 `securitiesInformation` 블록 합계). */
    shares: number;
    /** 매도 예정 금액(USD, 정수로 반올림, 블록 합계). */
    valueUsd: number;
    sharesOutstanding: number | null;
    /** `YYYY-MM-DD` — 블록 중 가장 이른 예정일. */
    approxSaleDate: string | null;
    /** `YYYY-MM-DD` — 10b5-1 계획 채택일 중 가장 늦은 날. 없으면 null. */
    planAdoptionDate: string | null;
    broker: string | null;
}

/** 저장되는 Form 144 한 행. */
export interface Form144Row extends Omit<
    Form144Document,
    'issuerCik' | 'issuerName'
> {
    accession: string;
    issuerCik: number;
    symbol: string;
    formType: string;
    filingDate: string;
}

/** Form 144·424B5 문서 재시도 큐의 한 건. */
export interface FilingRetry {
    accession: string;
    /** 10자리 0 패딩 CIK — 문서를 받을 폴더의 CIK. */
    cik: string;
    formType: string;
    filingDate: string;
    attempts: number;
}

/** 저장되는 Reg SHO 과열 목록 한 행. `market`은 `shared/api/exchange/regShoClient`의 `RegShoMarket`. */
export interface RegShoThresholdRow {
    symbol: string;
    tradeDate: string;
    market: string;
}

// ── 읽기 모델(스냅샷 조립이 core 타입으로 옮긴다) ─────────────────────────────────────────────────────────────

/** 심볼의 결제일별 FTD(여러 CUSIP은 합산). */
export interface FtdPointRecord {
    settlementDate: string;
    failsQty: number;
    price: number | null;
}

/**
 * 스냅샷에 담기는 Form 144 한 건 — core `ProposedSale`에 양식(`144` 원본 / `144/A` 정정)을 더한 것.
 * core는 이 필드를 모르지만 구조적으로 호환되므로 그대로 넘긴다. 옛 캐시 스냅샷에는 없을 수 있다.
 */
export type ProposedSaleFormType = '144' | '144/A';

export interface ProposedSaleWithForm extends ProposedSale {
    readonly formType: ProposedSaleFormType;
}

/** 심볼 발행사의 Form 144 한 건. */
export interface ProposedSaleRecord {
    accession: string;
    filingDate: string;
    formType: string;
    filer: string;
    /** 신고자 CIK(10자리). 0050 이전 행·CIK 없는 신고는 null. */
    filerCik: string | null;
    relationships: string[];
    shares: number;
    valueUsd: number;
    approxSaleDate: string | null;
    planAdoptionDate: string | null;
    url: string;
}

/** 심볼의 증자·희석 공시 한 건. */
export interface OfferingRecord {
    accession: string;
    filingDate: string;
    formType: string;
    kind: OfferingKind;
    url: string;
}

/** 분기별 13F 옵션 집계(풋·콜 명목). */
export interface OptionAggregateRecord {
    period: string;
    putHolders: number;
    putShares: number;
    putValueUsd: number;
    callHolders: number;
    callShares: number;
    callValueUsd: number;
}

/** 심볼의 과열 목록 등재 하루(그날 올라간 시장들). */
export interface ThresholdListingRecord {
    tradeDate: string;
    markets: string[];
}

/** 과열 목록 상태 요약(`summarizeThresholdListings`). */
export interface ThresholdStatusSummary {
    /** 가장 최근 수집 거래일에 목록에 있었는가. */
    listed: boolean;
    /** 가장 최근 수집 거래일부터 거슬러 끊김 없이 등재된 수집 거래일 수(미등재면 0). */
    consecutiveDays: number;
    /** 그 연속 구간의 첫 거래일. 미등재면 null. */
    firstListedDate: string | null;
    /** 가장 최근 수집 거래일에 등재된 시장들(정렬). */
    markets: string[];
    /** 판정 기준인 가장 최근 수집 거래일. 수집된 날이 없으면 null. */
    asOf: string | null;
}

// ── 한국 DART 지분공시(수집·저장 행 — 화면·분석 계약은 core `Kr*`) ──────────────────────────────────────────────────

/** `corpCode.xml`의 상장사 한 행 — 종목코드(6자리, 영문 섞일 수 있음) → DART 고유번호(8자리). */
export interface DartCorpCodeRow {
    stockCode: string;
    corpCode: string;
    corpName: string;
}

/** 대량보유 보고 형식 — `report_tp`의 `일반`·`약식`. */
export type DartReportForm = 'detailed' | 'abbreviated';

/** 저장되는 대량보유 상황보고(`majorstock.json`) 한 행. 비율은 %(예: `7.24`). 원천이 `-`·빈 값이면 null. */
export interface DartMajorHoldingRow {
    rceptNo: string;
    corpCode: string;
    /** 접수일 `YYYY-MM-DD`. */
    receiptDate: string;
    reporter: string;
    reportForm: DartReportForm;
    shares: number | null;
    sharesChange: number | null;
    ratioPct: number | null;
    ratioChangePct: number | null;
    reason: string | null;
}

/**
 * 저장되는 임원·주요주주 소유보고(`elestock.json`) 한 행. `registered`는 등기임원 여부(원천 `-`면 null),
 * `majorShareholder`는 원천의 주요주주 관계 문구(`10%이상주주` 등, `-`면 null — 스키마가 문구를 그대로 둔다).
 */
export interface DartInsiderReportRow {
    rceptNo: string;
    corpCode: string;
    receiptDate: string;
    reporter: string;
    position: string | null;
    registered: boolean | null;
    majorShareholder: string | null;
    shares: number | null;
    sharesChange: number | null;
    ratioPct: number | null;
    ratioChangePct: number | null;
}

/** 저장되는 거래계획보고서(`list.json` D005) 한 행 — 목록 행 그대로(원문 링크는 `rceptNo`에서 만든다). */
export interface DartTradingPlanRow {
    rceptNo: string;
    corpCode: string;
    receiptDate: string;
    reporter: string;
    title: string;
}

/** 공시검색(`list.json`) 행 하나에서 수집기가 쓰는 부분. */
export interface DartDisclosureListRow {
    rceptNo: string;
    corpCode: string;
    /** 상장사 종목코드. 비상장(기타법인)이면 null. */
    stockCode: string | null;
    receiptDate: string;
    /** 공시 제출인(`flr_nm`). */
    filer: string;
    /** 보고서명(`report_nm`). */
    title: string;
}

/** 종목코드 → DART 고유번호 매핑 결과(`resolveDartCorp`). */
export interface DartCorpMatch {
    corpCode: string;
    /** 실제로 `dart_corp_code`에서 찾은 종목코드 — 우선주면 보통주 코드다. */
    matchedStockCode: string;
    /** 우선주라 보통주 코드로 찾았는가. 화면이 "지분공시는 회사 단위라 보통주와 같다"는 안내에 쓴다. */
    viaCommonShare: boolean;
}

/** 한국 종목의 DART 회사 정보(`getInvestorFlowsScorecard`의 `krCompany`) — 화면·도구가 우선주 안내에 쓴다. */
export interface KrDisclosureCompany {
    readonly corpName: string;
    /** 우선주라 보통주 코드로 찾았다 — 지분공시는 회사 단위라 보통주와 같은 내용이다. */
    readonly viaCommonShare: boolean;
}

/** `dart_corp_code` 읽기 결과(`resolveCorpCode`). */
export interface DartCorpRecord extends DartCorpMatch {
    corpName: string;
}
