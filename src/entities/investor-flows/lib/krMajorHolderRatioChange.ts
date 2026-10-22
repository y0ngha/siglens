import type { KrMajorHolderReport } from '@y0ngha/siglens-core';
import { compareIsoDate } from './investorFlowsDates';

/** DART 보유비율 정밀도(소수 둘째 자리). 증감 비교 허용 오차도 이 자리의 절반이다. */
const RATIO_DECIMALS = 2;
const RATIO_EPSILON = 0.5 / 10 ** RATIO_DECIMALS;

function roundRatio(value: number): number {
    const scale = 10 ** RATIO_DECIMALS;
    return Math.round(value * scale) / scale;
}

/**
 * 접수 순서: 접수일, 같은 날이면 DART 접수번호(보고서 URL의 `rcpNo`, 접수 순으로 증가) 순.
 * 같은 날 같은 보고자의 두 보고가 서로를 직전 보고로 보지 못하면 core가 증감을 두 번 더한다.
 */
function receiptOrder(a: KrMajorHolderReport, b: KrMajorHolderReport): number {
    return (
        compareIsoDate(a.receiptDate, b.receiptDate) ||
        (a.url < b.url ? -1 : a.url > b.url ? 1 : 0)
    );
}

/** core `krMajorHolderAxis`와 같은 보고자 동일성 규칙(trim + 소문자). */
function reporterKey(row: KrMajorHolderReport): string {
    return row.reporter.trim().toLowerCase();
}

/**
 * 대량보유 보고 한 건의 보유비율 증감(%p) — 같은 보고자의 **직전 보고**와 비교한다.
 *
 * DART `stkrt_irds`(`ratioChangePct`)를 그대로 쓰면 최초(신규) 보고에서 틀린다: 신규 보고는 보유비율 전체를
 * 증감으로 적는다(5.12% 신규 보고 → "+5.12%p"). 실제로는 직전 보고 4.93% 대비 +0.19%p인 사례가 있었다.
 *
 * 1. 같은 보고자의 더 이른 보고(접수일, 같은 날이면 접수번호 순)가 있으면 가장 최근 것과 비교해 `ratioPct − 직전.ratioPct`.
 * 2. 없고, DART 증감이 보유비율 전체와 같으면(최초 보고의 모양) 계산할 수 없으므로 `null`.
 * 3. 그 밖에는 DART 증감을 쓴다 — 직전 보고가 조회 범위 밖에 있을 뿐인 일반 변동 보고다.
 */
export function majorHolderRatioChange(
    row: KrMajorHolderReport,
    rows: readonly KrMajorHolderReport[]
): number | null {
    const key = reporterKey(row);
    const previous = rows
        .filter(
            other =>
                other !== row &&
                reporterKey(other) === key &&
                receiptOrder(other, row) < 0
        )
        .toSorted((a, b) => receiptOrder(b, a))[0];
    if (previous !== undefined) {
        return roundRatio(row.ratioPct - previous.ratioPct);
    }
    if (Math.abs(row.ratioChangePct - row.ratioPct) < RATIO_EPSILON) {
        return null;
    }
    return row.ratioChangePct;
}

/**
 * core에 넘길 대량보유 보고의 `ratioChangePct`를 직전 보고 대비 값으로 바꾼다(스냅샷 조립 시 한 번).
 *
 * core `krMajorHolderAxis`는 보고자별 창 안 `ratioChangePct` 합을 순변동으로 쓰고, `ratioPct − 순변동`을
 * 직전 비율로 보아 5% 상향 돌파(`kr_major_holder_new`)를 판정한다. DART 값을 그대로 넘기면 최초 보고의 증감이
 * 보유비율 전체라, 직전 보고(예: 4.93%)가 데이터에 있어도 증거가 "+5.12%p"가 된다.
 *
 * 계산할 수 없는 최초 보고(직전 보고 없음)는 DART 값(= 보유비율 전체)을 **그대로 둔다** — core는 비유한 증감
 * 보고를 통째로 버리므로(`isFiniteNumber` 검사) `null`/`NaN`을 넘기면 5% 신규 진입 신호가 사라진다. DART
 * 값이면 직전 비율이 0으로 계산돼 "5% 미만 → 이상" 판정은 맞게 남는다. 화면·도구는 같은 모양을
 * {@link majorHolderRatioChange}로 보고 증감을 비운다.
 */
export function withPreviousReportRatioChanges(
    rows: readonly KrMajorHolderReport[]
): KrMajorHolderReport[] {
    return rows.map(row => {
        const change = majorHolderRatioChange(row, rows);
        return change === null || change === row.ratioChangePct
            ? row
            : { ...row, ratioChangePct: change };
    });
}
