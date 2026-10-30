/**
 * 내부자 거래 표(Form 4)의 데이터 — 매수·매도 행을 점수 창 기준으로 나누고 상한 밖으로 빠진 건수를 센다.
 */
import type {
    InsiderTransaction,
    InvestorFlowsWindow,
} from '@y0ngha/siglens-core';
import { compareIsoDate } from '@/entities/investor-flows/lib/investorFlowsDates';

/** 거래 표에 싣는 최대 건수(매수·매도만, 최신순). */
export const MAX_INSIDER_ROWS = 15;

/** 거래일이 점수 창의 어디에 있는가 — 창 시작 전, 창 안(양 끝 포함), 창 끝 후. */
type WindowPosition = 'before' | 'inside' | 'after';

/** 내부자 거래 표 데이터. */
export interface InsiderTableData {
    /** 점수 창(`freshness.insiderWindow`) 안의 거래 — 위 요약 카드의 건수·금액과 같은 거래들이다. 창을 모르면 전부. */
    rows: InsiderTransaction[];
    /** 점수 창이 시작되기 전의 거래(요약에 세지 않은 것). 창을 모르면 비어 있다. */
    beforeWindowRows: InsiderTransaction[];
    /** 점수 창이 끝난 뒤의 거래(요약에 세지 않은 것). 창을 모르면 비어 있다. */
    afterWindowRows: InsiderTransaction[];
    /** 표에서 뺀 `other`(증여·옵션 행사 등 장내 매수·매도가 아닌 신고) 건수. */
    omittedOtherCount: number;
    /** 매수·매도 중 `MAX_INSIDER_ROWS` 상한 밖이라 표에서 뺀 건수. */
    omittedCount: number;
}

/**
 * 거래일의 창 대비 위치. 창 끝을 모르면(`null`) 창 안으로 본다 — 나눌 근거가 없으면 나누지 않는다.
 * ISO 날짜 문자열 비교라 양 끝 날짜는 창 안이다.
 */
function windowPosition(
    date: string,
    scoringWindow: InvestorFlowsWindow | null
): WindowPosition {
    if (
        scoringWindow === null ||
        scoringWindow.from === null ||
        scoringWindow.to === null
    )
        return 'inside';
    if (compareIsoDate(date, scoringWindow.from) < 0) return 'before';
    if (compareIsoDate(date, scoringWindow.to) > 0) return 'after';
    return 'inside';
}

/**
 * 거래 표 데이터. 장내 매수(`buy`)·매도(`sell`)만 싣고 나머지(`other`)는 건수로만 알린다 — 증여·옵션
 * 행사·세금 원천징수가 섞이면 "내부자가 샀다/팔았다"를 읽을 수 없다.
 *
 * 상한(`MAX_INSIDER_ROWS`)은 창과 상관없이 **거래일 최신순으로 먼저** 자른다. 그래서 남는 행은 창 안팎을 가리지 않고 가장 최근
 * 거래들이고, 잘린 행은 가장 오래된 거래들이다(창 시작 전 거래가 먼저 잘리고, 창 끝 후 거래는 최신이라 마지막에 잘린다). 잘린
 * 건수는 `omittedCount`로 알린다.
 *
 * 점수 창(`scoringWindow`) 밖의 거래는 시작 전(`beforeWindowRows`)과 끝난 뒤(`afterWindowRows`)로 따로 담는다 — 요약
 * 카드("매수 0건")와 같은 목록에 섞이면 창 밖의 매수가 "0건" 아래에 보여 숫자와 목록이 어긋난다.
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
    const inPosition = (position: WindowPosition): InsiderTransaction[] =>
        shown.filter(tx => windowPosition(tx.date, scoringWindow) === position);
    return {
        rows: inPosition('inside'),
        beforeWindowRows: inPosition('before'),
        afterWindowRows: inPosition('after'),
        omittedOtherCount: sorted.length - traded.length,
        omittedCount: traded.length - shown.length,
    };
}

/** 직무 문자열을 짧게. FMP는 `officer: Chief Executive Officer`처럼 접두사를 붙인다. */
export function shortRole(role: string): string {
    const trimmed = role.trim();
    const colon = trimmed.indexOf(':');
    return colon >= 0 ? trimmed.slice(colon + 1).trim() : trimmed;
}
