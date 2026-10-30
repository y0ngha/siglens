import type {
    InsiderMetrics,
    InstitutionalHolderChangeKind,
    InvestorFlowsAxisId,
    InvestorFlowsComposite,
    InvestorFlowsEvidence,
    InvestorFlowsFreshness,
    InvestorFlowsLabel,
    InvestorFlowsSignalDirection,
    InvestorFlowsSignalId,
    InvestorFlowsSignalStrength,
    InvestorFlowsSufficiency,
    OfferingKind,
    ShortInterestTrend,
    InsiderTransactionType,
    SqueezeRiskComponentId,
    SqueezeRiskLevel,
    SqueezeRiskSufficiency,
} from '@y0ngha/siglens-core';
import type {
    PreviousSettlementChange,
    ProposedSaleFormType,
} from '../../model';

/** 분기 순변화의 부호 라벨(순매수 IN / 순매도 OUT / 보합 FLAT). */
export type NetFlow = 'IN' | 'OUT' | 'FLAT';

/** 요약에 싣는 축 하나 — 점수표의 라벨·점수·충분성만 남긴다. */
export interface SummaryAxis {
    readonly label: InvestorFlowsLabel;
    readonly score: number | null;
    readonly sufficiency: InvestorFlowsSufficiency;
}

/** 요약에 싣는 신호 하나(점수표 신호에서 모델이 읽을 필드만). */
export interface SummarySignal {
    readonly id: InvestorFlowsSignalId;
    readonly axis: InvestorFlowsAxisId;
    readonly direction: InvestorFlowsSignalDirection;
    readonly strength: InvestorFlowsSignalStrength;
    readonly evidence: InvestorFlowsEvidence;
    /**
     * 신호가 가리키는 대상(보고자·신고자 등, core `signal.subject`) — 같은 신호 ID가 둘 이상일 때(보고자별 `kr_major_holder_*`,
     * 방향별 `kr_insider_cluster` 등) 구분하는 유일한 단서다. 공시 원문이라 한 줄로 펴서 자른다. core가 주지 않으면 키가 없다.
     */
    readonly subject?: string;
}

/** 요약에 싣는 13F 분기 집계 하나. */
export interface SummaryQuarter {
    readonly period: string;
    readonly complete: boolean;
    readonly holders: number;
    readonly shares: number;
    readonly newHolders: number;
    readonly increased: number;
    readonly decreased: number;
    readonly exited: number;
    readonly netShareChange: number;
    /**
     * 부호만 읽으면 되도록 방향 라벨을 함께 둔다(순매수 IN / 순매도 OUT). 진행 중 분기(`complete: false`)는 일부 기관만 제출한
     * 부분 집계라 순변화가 방향을 뜻하지 않으므로 `null`이다(core도 진행 분기를 채점하지 않는다).
     */
    readonly netFlow: NetFlow | null;
}

/** 요약에 싣는 상위 보유 기관 한 곳. */
export interface SummaryHolder {
    readonly name: string;
    readonly shares: number;
    readonly changePct: number | null;
    readonly change: InstitutionalHolderChangeKind;
}

/** 요약에 싣는 내부자 거래 한 건. */
export interface SummaryTransaction {
    readonly date: string;
    readonly name: string;
    readonly role: string;
    readonly type: InsiderTransactionType;
    readonly valueUsd: number | null;
}

/** 요약에 싣는 13D/G 대량보유 신고 한 건. */
export interface SummaryLargeHolder {
    readonly filingDate: string;
    readonly filer: string;
    readonly form: string;
    readonly percentOfClass: number | null;
}

/** 요약의 공매도 섹션 — 잔고·장외 거래량과 모델이 오독하지 않도록 하는 안내(`note`)를 묶는다. */
export interface SummaryShort {
    /** 최신 결제일 공매도 잔고. 점수표(`short.metrics`) 값을 그대로 옮긴다 — 화면과 같은 숫자다. */
    readonly interest: {
        readonly settlementDate: string;
        readonly shortQty: number;
        readonly pctOfFloat: number | null;
        readonly daysToCover: number | null;
        /** 직전 결제일 대비 변화(주식 수·%). 화면 배지와 같은 함수(`computePreviousSettlementChange`)의 값이다. */
        readonly changeVsPrevious: PreviousSettlementChange | null;
        /** 최근 여러 결제일에 걸친 잔고 변화율(%, core 정의) — 직전 결제일 대비와는 다른 값이다. */
        readonly recentChangePct: number | null;
        /** `recentChangePct`의 양 끝 결제일(core `shortInterestChangeFromDate`·`ToDate`) — 날짜 없이 %를 인용하지 않게 함께 싣는다. */
        readonly recentChangeFromDate: string | null;
        readonly recentChangeToDate: string | null;
        readonly trend: ShortInterestTrend | null;
    } | null;
    readonly offExchangeVolume: {
        readonly date: string;
        readonly shortRatio: number | null;
        readonly zScore: number | null;
    } | null;
    readonly squeezeRisk: boolean;
    readonly note: string;
}

/** 13F 옵션 풋/콜 명목 비율(점수표 `institutional.metrics` 그대로). */
export interface SummaryPutCall {
    readonly period: string;
    readonly putCallValueRatio: number | null;
    readonly priorPutCallValueRatio: number | null;
    readonly note: string;
}

/** 요약에 싣는 Form 144 매도 예정 신고 한 건. */
export interface SummaryProposedSale {
    /** `144` 원본 / `144/A` 정정 — 건수에는 원본만 센다. */
    readonly formType: ProposedSaleFormType;
    readonly filingDate: string;
    readonly filer: string;
    readonly relationships: string;
    readonly shares: number;
    readonly valueUsd: number;
    /** Rule 10b5-1 계획에 따른 매도 예정이면 true. */
    readonly plan10b5_1: boolean;
}

/**
 * Form 144 **원본**(`144/A` 제외) 신고 건수 — `proposedSales`는 최근 5건만 보여 주므로 "최근 N일 몇 건" 질문은 이 값을 읽는다.
 * 창은 달력일이고 `windowTo`를 포함한다: `last30dFrom` = `windowTo` − 29일, `last90dFrom` = `windowTo` − 89일.
 */
export interface SummaryProposedSaleCounts {
    readonly last30d: number;
    readonly last90d: number;
    readonly windowTo: string;
    readonly last30dFrom: string;
    readonly last90dFrom: string;
    /** `false` = 일부 행에 양식 정보가 없어(옛 캐시 스냅샷) 정정을 못 걸러냈을 수 있다. */
    readonly excludesAmendments: boolean;
}

/** 요약에 싣는 증자·희석 공시 한 건. */
export interface SummaryOffering {
    readonly filingDate: string;
    readonly form: string;
    readonly kind: OfferingKind;
}

/** 요약의 결제 불이행(FTD) 섹션. */
export interface SummaryFailsToDeliver {
    /** 가장 최근 실패 결제일과 그날 수량. */
    readonly latestDate: string;
    readonly latestQty: number;
    /** 최근 창 최대값·발행주식 대비 %·기준선 대비 배수(점수표 `short.metrics`). */
    readonly peakQty: number | null;
    /** 최대값의 결제일(core `failsToDeliverPeakDate`) — 최대치는 이 날짜로만 인용한다(최신 파일 날짜가 아니다). */
    readonly peakDate: string | null;
    readonly peakPctOutstanding: number | null;
    readonly peakMultipleOfBaseline: number | null;
    readonly note: string;
}

/** 요약의 Reg SHO 과열 종목 목록 등재 상태. */
export interface SummaryThresholdList {
    readonly listed: boolean;
    readonly consecutiveDays: number;
    readonly firstListedDate: string | null;
    readonly markets: readonly string[];
    readonly asOf: string | null;
}

/** 숏스퀴즈 점수에 기여한 구성요소 하나(값과 점수 기여분). */
export interface SummarySqueezeComponent {
    readonly id: SqueezeRiskComponentId;
    readonly value: number;
    readonly contribution: number;
}

/**
 * 숏스퀴즈 점수의 근거. `positioning` = FINRA 공매도 포지션 입력(잔고·상환일수·추세·장외 비중 z)이 하나 이상 들어갔다.
 * `price_delivery_only` = 포지션 입력이 없어 결제 불이행·과열 목록·가격·거래량만으로 계산했다 — 공매도 쪽 포지션을 모르므로
 * **숏스퀴즈 판독이 아니다**(core `includesFinra`가 거짓, FINRA 꺼짐·데이터 없음).
 */
export type SummarySqueezeBasis = 'positioning' | 'price_delivery_only';

/** 요약의 숏스퀴즈 위험 섹션. */
export interface SummarySqueezeRisk {
    readonly score: number | null;
    readonly level: SqueezeRiskLevel | null;
    readonly sufficiency: SqueezeRiskSufficiency;
    /** 공매도 포지션 입력이 없어 `elevated`에서 멈췄다. */
    readonly levelCapped: boolean;
    readonly topComponents: readonly SummarySqueezeComponent[];
    readonly lastBarDate: string | null;
    readonly basis: SummarySqueezeBasis;
    /** `basis`가 `price_delivery_only`일 때만 — 모델이 이 점수를 숏스퀴즈 위험으로 말하지 않게 하는 안내. 레벨은 그대로 둔다. */
    readonly note?: string;
}

/** `get_investor_flows`가 모델과 공개 API에 내는 압축 요약의 계약. */
export interface InvestorFlowsSummary {
    readonly composite: InvestorFlowsComposite;
    readonly axes: Readonly<Record<InvestorFlowsAxisId, SummaryAxis>>;
    readonly signals: readonly SummarySignal[];
    readonly freshness: InvestorFlowsFreshness;
    readonly institutional: {
        readonly quarters: readonly SummaryQuarter[];
        readonly topHoldersPeriod: string | null;
        readonly topHolders: readonly SummaryHolder[];
        /** 13F 옵션 분기가 없으면 `null`. */
        readonly putCall: SummaryPutCall | null;
    };
    readonly insider: {
        readonly metrics: InsiderMetrics | null;
        readonly recentTransactions: readonly SummaryTransaction[];
        /** Form 144 매도 예정 신고 최근 건. `null` = 이 원천이 스냅샷에 없다(조회 실패·수집 중). */
        readonly proposedSales: readonly SummaryProposedSale[] | null;
        /** `proposedSales`와 같은 원천이 없으면 `null`. */
        readonly proposedSalesCounts: SummaryProposedSaleCounts | null;
    };
    /** `null` = 13D/13G 조회 실패(없음 `[]`과 다르다). */
    readonly largeHolders: readonly SummaryLargeHolder[] | null;
    /** 증자·희석 공시 최근 건. `null` = 이 원천이 스냅샷에 없다(조회 실패·수집 중). */
    readonly offerings: readonly SummaryOffering[] | null;
    /**
     * `null` = FINRA 꺼짐, 또는 켜졌지만 잔고·장외 거래량 행이 하나도 없음(빈 블록을 내지 않는다). 숏스퀴즈 점수는 이와 별개로
     * 최상위 `squeezeRisk`에 실린다.
     */
    readonly short: SummaryShort | null;
    /** `null` = 결제 불이행 행이 없거나 조회 불가. */
    readonly failsToDeliver: SummaryFailsToDeliver | null;
    /** `null` = 과열 목록 플래그 꺼짐·수집 전. */
    readonly thresholdList: SummaryThresholdList | null;
    /** `null` = 가격 입력이 없어 점수를 만들지 않았다. */
    readonly squeezeRisk: SummarySqueezeRisk | null;
}
