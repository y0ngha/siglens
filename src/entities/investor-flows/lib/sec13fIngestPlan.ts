import { addDays, isQuarterEnd } from './investorFlowsDates';
import { INVESTOR_FLOWS_13F_MAX_ATTEMPTS } from './investorFlowsPolicy';
import type {
    FilingRecord,
    PositionApplyMode,
    Sec13fFilingMeta,
} from '../model';
import type { AmendmentFiling } from './amendmentPlan';

/** 같은 날 index를 다시 읽는 겹침(일). 늦게 반영된 제출·직전 실행이 중단된 날을 주운다. */
export const CURSOR_OVERLAP_DAYS = 3;
/** 2023-03-31 보고 분기부터 `value`가 달러 단위다. 이전 분기는 천 달러라 수집하지 않는다. */
export const FIRST_DOLLAR_VALUE_PERIOD = '2023-03-31';

/** 포지션 없이 "처리됨"만 기록하는 제출의 사유. */
export type FilingSkipReason =
    | 'non-quarter-period'
    | 'legacy-value-units'
    | 'before-retention'
    | 'notice';

/**
 * 포지션을 읽지 않고 "처리됨"만 기록할 제출인지 판정한다 — 분기말이 아닌 보고 기간, 단위가 다른 옛 분기
 * (`FIRST_DOLLAR_VALUE_PERIOD` 이전), 보존 하한(`floor`) 이전 분기, 통지(NOTICE)가 해당한다. 앞의 사유가 우선한다.
 */
export function filingSkipReason(
    period: string,
    reportType: Sec13fFilingMeta['reportType'],
    floor: string
): FilingSkipReason | null {
    if (!isQuarterEnd(period)) return 'non-quarter-period';
    if (period < FIRST_DOLLAR_VALUE_PERIOD) return 'legacy-value-units';
    if (period < floor) return 'before-retention';
    if (reportType?.toUpperCase().includes('NOTICE')) return 'notice';
    return null;
}

/**
 * 일일 index를 읽기 시작할 날짜: 원장의 마지막 제출일에서 `CURSOR_OVERLAP_DAYS`를 뺀 날. 원장이 비었거나 그 날짜가
 * 백필 시작일보다 이르면 백필 시작일이다(ISO 날짜라 문자열 비교가 날짜 비교다).
 */
export function cursorStartDate(
    lastFilingDate: string | null,
    backfillStart: string
): string {
    if (lastFilingDate === null) return backfillStart;
    const overlapStart = addDays(lastFilingDate, -CURSOR_OVERLAP_DAYS);
    return overlapStart > backfillStart ? overlapStart : backfillStart;
}

/** 원장에 이미 반영됐거나 시도를 소진해 더는 다시 받지 않는 제출인가. */
export function isFilingSettled(record: FilingRecord | undefined): boolean {
    return (
        record !== undefined &&
        (record.processedAt !== null ||
            record.attempts >= INVESTOR_FLOWS_13F_MAX_ATTEMPTS)
    );
}

/**
 * 원장이 비었는데 포지션이 이미 있는 원본 13F-HR 교체 후보인가 — `reingest-13f`가 원장을 지운 뒤의 재수집이다. 호출부가
 * 포지션 존재 여부(DB)까지 확인하면 `merge`로 낮춘다: `replace`로 반영하면 이미 병합돼 있던 NEW HOLDINGS 정정 행까지
 * 지워져, 정정을 다시 읽을 때까지 보유 수치가 일시적으로 줄어든다. RESTATEMENT는 정의상 교체라 해당하지 않는다.
 */
export function isReingestReplaceCandidate(
    mode: PositionApplyMode,
    formType: string,
    existing: readonly AmendmentFiling[]
): boolean {
    return mode === 'replace' && formType === '13F-HR' && existing.length === 0;
}
