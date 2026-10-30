import type { DartDisclosureDetailType } from '@/shared/api/dart/dartClient';
import {
    mergePending,
    type DartBackfillCursor,
    type DartListCursor,
    type DartPendingCorp,
} from './dartIngestState';
import { addDays } from './investorFlowsDates';
import {
    INVESTOR_FLOWS_DART_LIST_INITIAL_LOOKBACK_DAYS,
    INVESTOR_FLOWS_DART_LIST_MAX_LOOKBACK_DAYS,
    INVESTOR_FLOWS_REVALIDATE_CAP,
} from './investorFlowsPolicy';

/** 대량보유(D001)·소유보고(D002) — 새 공시가 있으면 그 회사의 두 보고를 다시 받는다. */
export const REFETCH_TRIGGER_TYPES: readonly DartDisclosureDetailType[] = [
    'D001',
    'D002',
];
/** 거래계획보고서(D005) — 목록 행 자체를 저장한다. */
export const TRADING_PLAN_TYPE: DartDisclosureDetailType = 'D005';

/** 상세 유형 하나의 검색 시작일 — 커서가 없으면 유형별 첫 창, 있으면 그날부터(3개월 검색 한도로 자른다). */
export function scanStart(
    cursor: DartListCursor,
    detailType: DartDisclosureDetailType,
    today: string
): string {
    const floor = addDays(today, -INVESTOR_FLOWS_DART_LIST_MAX_LOOKBACK_DAYS);
    const initial =
        detailType === TRADING_PLAN_TYPE
            ? floor
            : addDays(today, -INVESTOR_FLOWS_DART_LIST_INITIAL_LOOKBACK_DAYS);
    const resume =
        detailType === TRADING_PLAN_TYPE
            ? (cursor.tradingPlansFrom ?? cursor.through)
            : cursor.through;
    const start = resume ?? initial;
    return start < floor ? floor : start;
}

/** 접수일이 더 늦은 쪽 — 읽은 행(유니버스 밖 포함)의 재개 지점을 갱신하는 데 쓴다. `current`가 null이면 행 중 최댓값. */
export function latestReceiptDate(
    rows: readonly { receiptDate: string }[],
    current: string | null
): string | null {
    return rows.reduce<string | null>(
        (latest, row) =>
            latest === null || row.receiptDate > latest
                ? row.receiptDate
                : latest,
        current
    );
}

/**
 * 넘친 D005 창을 다음 실행이 다시 읽기 시작할 날짜. 오래된 순으로 읽으므로 마지막 접수일 이전은 끝까지 읽었고, 그날의 남은 행은 뒤
 * 페이지에 있을 수 있어 **그날부터** 다시 읽는다(upsert라 겹쳐 읽어도 멱등). 상한만큼의 페이지가 모두 시작일 하루였다면
 * (`daySaturated`) 그날부터 다시 읽어도 같은 페이지만 받으므로 다음 날로 넘긴다 — 진행을 보장하는 대가로 그날의 나머지를
 * 잃으므로 호출부가 로그로 남긴다.
 */
export function overflowResume(
    lastReceiptDate: string | null,
    from: string
): { date: string; daySaturated: boolean } {
    const last = lastReceiptDate ?? from;
    if (last > from) return { date: last, daySaturated: false };
    return { date: addDays(from, 1), daySaturated: true };
}

/**
 * 공시검색 뒤의 재조회 대기열 = 이전 대기열 + 새 공시 회사(순서 유지). 유니버스에서 빠진 회사(상장폐지 등)는 버린다.
 */
export function nextPendingQueue(
    previous: readonly DartPendingCorp[],
    changedCorps: ReadonlySet<string>,
    universeCorps: ReadonlySet<string>
): DartPendingCorp[] {
    return mergePending(
        previous,
        [...changedCorps].map(corpCode => ({ corpCode, attempts: 0 }))
    ).filter(entry => universeCorps.has(entry.corpCode));
}

/** 최초 백필이 아직 받지 않은 회사 — 커서(마지막으로 끝낸 고유번호) 뒤의 고유번호들. */
export function backfillTargetsAfter(
    corpCodes: readonly string[],
    cursor: DartBackfillCursor
): string[] {
    return corpCodes.filter(
        corpCode =>
            cursor.afterCorpCode === null || corpCode > cursor.afterCorpCode
    );
}

/** 행이 바뀐 회사의 심볼을 정렬해 무효화 상한(`INVESTOR_FLOWS_REVALIDATE_CAP`)까지 자른다. */
export function symbolsToInvalidate(
    changedCorps: ReadonlySet<string>,
    symbolsByCorp: ReadonlyMap<string, readonly string[]>
): string[] {
    return [...changedCorps]
        .flatMap(corpCode => symbolsByCorp.get(corpCode) ?? [])
        .toSorted()
        .slice(0, INVESTOR_FLOWS_REVALIDATE_CAP);
}
