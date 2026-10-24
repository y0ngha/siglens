import type {
    InvestorFlowsAxisId,
    InvestorFlowsComposite,
    InvestorFlowsScorecard,
    InvestorFlowsSnapshot,
    KrInsiderMetrics,
    KrInsiderReport,
    KrMajorHolderMetrics,
    KrMajorHolderReport,
    KrMajorHolderReportForm,
    KrTradingPlan,
} from '@y0ngha/siglens-core';
import { compareIsoDate } from './investorFlowsDates';
import { majorHolderRatioChange } from './krMajorHolderRatioChange';
import {
    clipSummaryText,
    pickSummarySignals,
    summarizeAxis,
    SUMMARY_NAME_MAX_CHARS,
    SUMMARY_ROLE_MAX_CHARS,
    type SummaryAxis,
    type SummarySignal,
} from './summarizeInvestorFlows';

/**
 * 한국 종목 `get_investor_flows` 결과의 상한. 도구 상한(`INVESTOR_FLOWS_RESULT_MAX_CHARS`, 8,500자) 안에 600자 이상의 여유를
 * 두고 들어가야 하며, 같은 출력에 네이버 투자자별 추세(`krInvestorTrend`)가 함께 실린다. DART 목록 세 개는 이 상수들로, 추세는
 * 행 수를 최신 10거래일로 잘라(`KR_TREND_ROWS_SHOWN`; 5·20일 합은 가져온 20행 전체로 계산) 예산을 맞춘다. 최악 입력(긴 보고자명·사유·제목,
 * 목록마다 상한 초과, 가득 찬 추세)으로 잰 전체 출력 길이를 `getInvestorFlows.test.ts`가 고정한다. 상수를 올리면 그 테스트가 먼저 깨진다.
 */
export const KR_SUMMARY_MAX_MAJOR_HOLDERS = 5;
export const KR_SUMMARY_MAX_INSIDERS = 6;
export const KR_SUMMARY_MAX_TRADING_PLANS = 5;
/** 대량보유 보고 사유(`report_resn`, 자유 문구)와 거래계획보고서 제목의 최대 길이. */
const KR_SUMMARY_TEXT_MAX_CHARS = 40;

export interface KrSummaryMajorHolder {
    readonly receiptDate: string;
    readonly reporter: string;
    readonly form: KrMajorHolderReportForm;
    readonly ratioPct: number;
    /**
     * 같은 보고자의 직전 보고 대비 보유비율 증감(%p). `null`이면 계산할 수 없다는 뜻이다 — 최초(신규) 보고인데
     * 직전 보고가 데이터에 없을 때. {@link majorHolderRatioChange} 참고.
     */
    readonly ratioChangePct: number | null;
    readonly sharesChange: number;
    readonly reason: string;
}

export interface KrSummaryInsider {
    readonly receiptDate: string;
    readonly reporter: string;
    readonly position: string | null;
    readonly registered: boolean;
    readonly majorShareholder: boolean;
    readonly shares: number;
    readonly sharesChange: number;
    readonly ratioPct: number;
    readonly ratioChangePct: number;
}

export interface KrSummaryTradingPlan {
    readonly receiptDate: string;
    readonly reporter: string;
    readonly title: string;
}

/** 한국 종목 `get_investor_flows`가 모델과 공개 API에 내는 압축 요약의 계약. */
export interface KrInvestorFlowsSummary {
    readonly composite: InvestorFlowsComposite;
    /** 다섯 축 전부 — 미국 전용 축(기관·공매도·희석)은 core가 `insufficient`로 준다(모델이 "제공하지 않음"으로 말하도록). */
    readonly axes: Readonly<Record<InvestorFlowsAxisId, SummaryAxis>>;
    readonly signals: readonly SummarySignal[];
    /** 점수를 매긴 창과 가장 최근 DART 접수일. */
    readonly freshness: {
        readonly asOf: string | null;
        readonly windowDays: number;
        readonly latestReceiptDate: string | null;
    };
    readonly majorHolders: {
        /**
         * core 점수표 `largeHolders.krMetrics`. 쓸 수 있는 보고가 하나도 없으면 `null`, 창 밖에만 있으면 `reports: 0`과
         * `latestReceiptDate`로 온다("최근 공시 없음" — 데이터 부족이 아니다).
         */
        readonly metrics: KrMajorHolderMetrics | null;
        readonly recent: readonly KrSummaryMajorHolder[];
    };
    readonly insiders: {
        /**
         * core 점수표 `insider.krMetrics`. 쓸 수 있는 보고도 창 안 거래계획도 없으면 `null`, 보고가 창 밖에만 있으면
         * `reports: 0`과 `latestReceiptDate`로 온다.
         */
        readonly metrics: KrInsiderMetrics | null;
        readonly recent: readonly KrSummaryInsider[];
    };
    readonly tradingPlans: readonly KrSummaryTradingPlan[];
}

function newestFirst<T extends { readonly receiptDate: string }>(
    rows: readonly T[],
    max: number
): T[] {
    return rows
        .toSorted((a, b) => compareIsoDate(b.receiptDate, a.receiptDate))
        .slice(0, max);
}

function summarizeMajorHolder(
    row: KrMajorHolderReport,
    rows: readonly KrMajorHolderReport[]
): KrSummaryMajorHolder {
    return {
        receiptDate: row.receiptDate,
        reporter: clipSummaryText(row.reporter, SUMMARY_NAME_MAX_CHARS),
        form: row.reportForm,
        ratioPct: row.ratioPct,
        ratioChangePct: majorHolderRatioChange(row, rows),
        sharesChange: row.sharesChange,
        reason: clipSummaryText(row.reason, KR_SUMMARY_TEXT_MAX_CHARS),
    };
}

function summarizeInsider(row: KrInsiderReport): KrSummaryInsider {
    return {
        receiptDate: row.receiptDate,
        reporter: clipSummaryText(row.reporter, SUMMARY_NAME_MAX_CHARS),
        position:
            row.position === null
                ? null
                : clipSummaryText(row.position, SUMMARY_ROLE_MAX_CHARS),
        registered: row.registered,
        majorShareholder: row.majorShareholder,
        shares: row.shares,
        sharesChange: row.sharesChange,
        ratioPct: row.ratioPct,
        ratioChangePct: row.ratioChangePct,
    };
}

function summarizeTradingPlan(row: KrTradingPlan): KrSummaryTradingPlan {
    return {
        receiptDate: row.receiptDate,
        reporter: clipSummaryText(row.reporter, SUMMARY_NAME_MAX_CHARS),
        title: clipSummaryText(row.title, KR_SUMMARY_TEXT_MAX_CHARS),
    };
}

/**
 * 한국 종목(`market: 'kr'`)의 `get_investor_flows` 압축 요약 — DART 대량보유(5%)·임원·주요주주 소유보고·거래계획보고서. 점수·라벨·
 * 신호·창 수치는 core 점수표(`evaluateInvestorFlows`)에서 그대로 옮기고, 원본 목록은 최신 접수일 순으로 상한(`KR_SUMMARY_MAX_*`)까지
 * 자른다(보고자명·사유·제목은 공시 원문이라 길이도 자른다). 미국 전용 구간(13F·FINRA·SEC)은 싣지 않는다 — 한국에는 그 원천이 없다.
 */
export function summarizeKrInvestorFlows(
    snapshot: InvestorFlowsSnapshot,
    scorecard: InvestorFlowsScorecard
): KrInvestorFlowsSummary {
    const kr = snapshot.kr ?? {
        majorHolders: [],
        insiders: [],
        tradingPlans: [],
    };
    return {
        composite: scorecard.composite,
        axes: {
            institutional: summarizeAxis(scorecard.institutional),
            insider: summarizeAxis(scorecard.insider),
            largeHolders: summarizeAxis(scorecard.largeHolders),
            short: summarizeAxis(scorecard.short),
            dilution: summarizeAxis(scorecard.dilution),
        },
        signals: pickSummarySignals(scorecard),
        freshness: {
            asOf: scorecard.freshness.asOf,
            windowDays: scorecard.freshness.insiderWindow.days,
            latestReceiptDate: scorecard.freshness.krDisclosureLatestDate,
        },
        majorHolders: {
            metrics: scorecard.largeHolders.krMetrics ?? null,
            recent: newestFirst(
                kr.majorHolders,
                KR_SUMMARY_MAX_MAJOR_HOLDERS
            ).map(row => summarizeMajorHolder(row, kr.majorHolders)),
        },
        insiders: {
            metrics: scorecard.insider.krMetrics ?? null,
            recent: newestFirst(kr.insiders, KR_SUMMARY_MAX_INSIDERS).map(
                summarizeInsider
            ),
        },
        tradingPlans: newestFirst(
            kr.tradingPlans,
            KR_SUMMARY_MAX_TRADING_PLANS
        ).map(summarizeTradingPlan),
    };
}
