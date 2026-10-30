/**
 * 한국 DART 공시 표(대량보유·소유보고·거래계획)의 행 선택과 한국 수급 탭의 수집 중 판정.
 */
import type {
    InvestorFlowsAxisId,
    InvestorFlowsSnapshot,
} from '@y0ngha/siglens-core';
import { compareIsoDate } from '@/entities/investor-flows/lib/investorFlowsDates';
import { isKrDisclosureCollecting } from '@/entities/investor-flows/lib/investorFlowsReadiness';
import type { InvestorFlowsPipelineReadiness } from '@/entities/investor-flows/model';
import type { LimitedRows } from './secFilings';

/** 대량보유·소유보고·거래계획 표에 싣는 최대 건수(최신 접수일 순). */
export const MAX_KR_DISCLOSURE_ROWS = 10;

/** 한국 점수표가 그리는 축 — DART 원천이 있는 두 축(core가 한국 평가 결과를 이 슬롯에 넣는다). */
export const KR_SCORECARD_AXES: readonly InvestorFlowsAxisId[] = [
    'largeHolders',
    'insider',
];

/** 한국 수급 탭의 수집 중 판정과, 그 때문에 "수집 중"으로 말할 점수표 축. */
export interface KrCollectingView {
    readonly collecting: boolean;
    readonly collectingAxes: readonly InvestorFlowsAxisId[];
}

/**
 * DART 초기 수집이 끝나지 않았고 세 공시 목록이 모두 비었는지 판정한다. 수집 중이면 점수표의 두 축도 "수집 중"으로 말한다.
 * 한국은 `dart` 갈래만 본다 — 13F·FINRA 수집 중이 여기 뜨지 않는다.
 */
export function buildKrCollectingView(
    readiness: InvestorFlowsPipelineReadiness,
    snapshot: InvestorFlowsSnapshot
): KrCollectingView {
    const collecting = isKrDisclosureCollecting(readiness, snapshot);
    return {
        collecting,
        collectingAxes: collecting ? KR_SCORECARD_AXES : [],
    };
}

/** 최신 접수일 순으로 `MAX_KR_DISCLOSURE_ROWS`건까지. 같은 날은 원래 순서(저장소의 접수번호 역순)를 지킨다. */
export function newestKrRows<T extends { readonly receiptDate: string }>(
    rows: readonly T[]
): LimitedRows<T> {
    const sorted = rows.toSorted((a, b) =>
        compareIsoDate(b.receiptDate, a.receiptDate)
    );
    return {
        rows: sorted.slice(0, MAX_KR_DISCLOSURE_ROWS),
        omittedCount: Math.max(0, sorted.length - MAX_KR_DISCLOSURE_ROWS),
    };
}

/** 한 접수번호에 보고자가 여럿일 수 있어(공동 보고) 보고자까지 키에 넣는다. 세 표(대량보유·소유보고·거래계획)가 같은 규칙을 쓴다. */
export function krDisclosureKey(row: {
    readonly url: string;
    readonly reporter: string;
}): string {
    return `${row.url}-${row.reporter}`;
}
