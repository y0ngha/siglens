import type {
    InsiderTransaction,
    InvestorFlowsWindow,
} from '@y0ngha/siglens-core';
import { compareIsoDate } from '@/entities/investor-flows/lib/investorFlowsDates';

/** 거래 표에 싣는 최대 건수(매수·매도만, 최신순). */
export const MAX_INSIDER_ROWS = 15;

export interface InsiderTableData {
    /** 점수 창(`freshness.insiderWindow`) 안의 거래 — 위 요약 카드의 건수·금액과 같은 거래들이다. 창을 모르면 전부. */
    rows: InsiderTransaction[];
    /** 점수 창 밖의 거래(요약에 세지 않은 것). 창을 모르면 비어 있다. */
    outsideWindowRows: InsiderTransaction[];
    /** 표에서 뺀 `other`(증여·옵션 행사 등 장내 매수·매도가 아닌 신고) 건수. */
    omittedOtherCount: number;
}

/** 거래일이 점수 창 안인가(양 끝 포함). 창 끝을 모르면(`null`) 창 안으로 본다 — 나눌 근거가 없으면 나누지 않는다. */
function isInWindow(
    date: string,
    scoringWindow: InvestorFlowsWindow | null
): boolean {
    if (
        scoringWindow === null ||
        scoringWindow.from === null ||
        scoringWindow.to === null
    )
        return true;
    return (
        compareIsoDate(date, scoringWindow.from) >= 0 &&
        compareIsoDate(date, scoringWindow.to) <= 0
    );
}

/**
 * 거래 표 데이터. 장내 매수(`buy`)·매도(`sell`)만 싣고 나머지(`other`)는 건수로만 알린다 — 증여·옵션
 * 행사·세금 원천징수가 섞이면 "내부자가 샀다/팔았다"를 읽을 수 없다. 최신 거래일 순, 합쳐 `MAX_INSIDER_ROWS`건.
 *
 * 점수 창(`scoringWindow`) 밖의 거래는 `outsideWindowRows`로 따로 담는다 — 요약 카드("매수 0건")와 같은 목록에 섞이면 창 밖의 매수가
 * "0건" 아래에 보여 숫자와 목록이 어긋난다. 화면은 이 거래들을 "집계 기간 밖" 묶음으로 따로 보여 준다.
 */
export function buildInsiderTable(
    transactions: readonly InsiderTransaction[],
    scoringWindow: InvestorFlowsWindow | null = null
): InsiderTableData {
    const sorted = transactions.toSorted((a, b) =>
        compareIsoDate(b.date, a.date)
    );
    const traded = sorted.filter(tx => tx.type !== 'other');
    const shown = traded.slice(0, MAX_INSIDER_ROWS);
    return {
        rows: shown.filter(tx => isInWindow(tx.date, scoringWindow)),
        outsideWindowRows: shown.filter(
            tx => !isInWindow(tx.date, scoringWindow)
        ),
        omittedOtherCount: sorted.length - traded.length,
    };
}

/** 직무 문자열을 짧게. FMP는 `officer: Chief Executive Officer`처럼 접두사를 붙인다. */
export function shortRole(role: string): string {
    const trimmed = role.trim();
    const colon = trimmed.indexOf(':');
    return colon >= 0 ? trimmed.slice(colon + 1).trim() : trimmed;
}
