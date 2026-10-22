import type {
    InvestorFlowsSnapshot,
    KrInsiderReport,
    KrMajorHolderReport,
    KrTradingPlan,
} from '@y0ngha/siglens-core';
import type {
    DartInsiderReportRecord,
    DartMajorHoldingRecord,
    DartTradingPlanRecord,
} from '../api/investorFlowsDartRepository';
import { withPreviousReportRatioChanges } from './krMajorHolderRatioChange';

/**
 * 한국(DART) 수급 스냅샷 조립(순수, 설계 §4.4). 저장소 행(`dart_*` 테이블)을 core `Kr*` 계약으로 옮긴다.
 *
 * - 원문 링크는 접수번호로 만든다(`dart.fss.or.kr/dsaf001/main.do?rcpNo=…`, 설계 §4.1).
 * - **수치가 비어 있는 행(원천 `-`)은 스냅샷에서 뺀다.** core 타입은 수량·비율이 `number`라 `0`으로 채우면 "변동 없음"·"0주
 *   보유"로 읽히고, core 평가도 비유한 비율·증감 행은 어차피 버린다(`evaluateKrMajorHolderAxis`·`evaluateKrInsiderAxis`). 화면·AI·
 *   점수가 같은 행을 보도록 여기서 한 번 거른다.
 * - 등기 여부가 비어 있으면(`-`, 임원이 아닌 주요주주) `registered: false`, 주요주주 관계 문구가 있으면 `majorShareholder: true`.
 * - 미국 전용 원천(13F·Form 4·13D/G·FINRA·SEC)은 비우거나 `null`로 둔다 — `market: 'kr'`이면 core는 `kr`만 읽는다.
 */

/** DART 공시 원문 뷰어 주소. */
export const DART_FILING_VIEWER_URL = 'https://dart.fss.or.kr/dsaf001/main.do';

/** 접수번호 → DART 원문 링크. */
export function dartFilingUrl(rceptNo: string): string {
    return `${DART_FILING_VIEWER_URL}?rcpNo=${encodeURIComponent(rceptNo)}`;
}

/** 수량·비율 넷 중 하나라도 비어 있으면 null — 스냅샷에서 뺀다. */
function quantified(row: {
    readonly shares: number | null;
    readonly sharesChange: number | null;
    readonly ratioPct: number | null;
    readonly ratioChangePct: number | null;
}): {
    shares: number;
    sharesChange: number;
    ratioPct: number;
    ratioChangePct: number;
} | null {
    const { shares, sharesChange, ratioPct, ratioChangePct } = row;
    if (
        shares === null ||
        sharesChange === null ||
        ratioPct === null ||
        ratioChangePct === null
    )
        return null;
    return { shares, sharesChange, ratioPct, ratioChangePct };
}

export function toKrMajorHolderReport(
    row: DartMajorHoldingRecord
): KrMajorHolderReport | null {
    const numbers = quantified(row);
    if (numbers === null) return null;
    return {
        receiptDate: row.receiptDate,
        reporter: row.reporter,
        reportForm: row.reportForm,
        ...numbers,
        reason: row.reason ?? '',
        url: dartFilingUrl(row.rceptNo),
    };
}

export function toKrInsiderReport(
    row: DartInsiderReportRecord
): KrInsiderReport | null {
    const numbers = quantified(row);
    if (numbers === null) return null;
    return {
        receiptDate: row.receiptDate,
        reporter: row.reporter,
        position: row.position,
        registered: row.registered ?? false,
        majorShareholder: row.majorShareholder !== null,
        ...numbers,
        url: dartFilingUrl(row.rceptNo),
    };
}

export function toKrTradingPlan(row: DartTradingPlanRecord): KrTradingPlan {
    return {
        receiptDate: row.receiptDate,
        reporter: row.reporter,
        title: row.title,
        url: dartFilingUrl(row.rceptNo),
    };
}

export interface KrSnapshotInput {
    /** 기준일(KST 달력 날짜 `YYYY-MM-DD`) — DART 접수일이 KST라 같은 달력으로 잰다. */
    readonly asOf: string;
    readonly majorHoldings: readonly DartMajorHoldingRecord[];
    readonly insiderReports: readonly DartInsiderReportRecord[];
    readonly tradingPlans: readonly DartTradingPlanRecord[];
    /** 발행주식수 — 보통주의 상장주식수(`korean_tickers.listed_shares`). 모르면 `null`(core는 보유비율 증감 합으로 대신한다). */
    readonly sharesOutstanding: number | null;
}

export interface KrSnapshotAssembly {
    /** 세 목록이 모두 비면 `null` — 이 회사는 2년 안에 지분공시가 없다("데이터 없음"). */
    readonly snapshot: InvestorFlowsSnapshot | null;
    /** 수치가 비어 스냅샷에서 뺀 행 수(대량보유 + 소유보고). */
    readonly droppedRows: number;
}

export function assembleKrInvestorFlowsSnapshot(
    input: KrSnapshotInput
): KrSnapshotAssembly {
    // 증감은 같은 보고자의 직전 보고 대비로 바꿔 넘긴다 — DART 증감은 최초 보고에서 보유비율 전체다
    // (`withPreviousReportRatioChanges` JSDoc).
    const majorHolders = withPreviousReportRatioChanges(
        input.majorHoldings
            .map(toKrMajorHolderReport)
            .filter(row => row !== null)
    );
    const insiders = input.insiderReports
        .map(toKrInsiderReport)
        .filter(row => row !== null);
    const tradingPlans = input.tradingPlans.map(toKrTradingPlan);
    const droppedRows =
        input.majorHoldings.length -
        majorHolders.length +
        (input.insiderReports.length - insiders.length);
    if (
        majorHolders.length === 0 &&
        insiders.length === 0 &&
        tradingPlans.length === 0
    ) {
        return { snapshot: null, droppedRows };
    }
    return {
        snapshot: {
            asOf: input.asOf,
            market: 'kr',
            sharesOutstanding: input.sharesOutstanding,
            floatShares: null,
            institutional: {
                quarters: [],
                topHolders: [],
                topHoldersPeriod: null,
            },
            insider: { transactions: [] },
            largeHolders: null,
            shortInterest: null,
            shortVolume: null,
            failsToDeliver: null,
            thresholdList: null,
            kr: { majorHolders, insiders, tradingPlans },
        },
        droppedRows,
    };
}
