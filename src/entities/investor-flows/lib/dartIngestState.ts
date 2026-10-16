/**
 * DART 공시 수집 상태(`investor_flows_state`, JSON). 깨졌거나 비었으면 빈 상태로 읽는다 — 깨진 값으로 수집이 멈추지 않게 한다
 * (빈 상태의 비용은 겹쳐 읽기뿐이다. upsert라 멱등).
 *
 *  - 목록 커서 `dart_list_cursor`: `through` = 공시검색을 끝까지 읽은 마지막 KST 날짜(다음 실행은 **그날부터 다시** 읽는다 —
 *    같은 날 늦게 들어온 공시를 놓치지 않게). `pending` = 새 D001·D002 공시가 있어 `majorstock`·`elestock`을 다시 받아야 할
 *    회사와 일시 오류 시도 횟수. 대기열을 상태에 두는 이유: 한 실행의 호출 상한보다 회사가 많으면(장기 중단 뒤) 커서만으로는
 *    같은 앞쪽 회사만 계속 받고 뒤쪽이 굶는다.
 *  - 백필 커서 `dart_backfill_cursor`: `afterCorpCode` = 최초 백필에서 마지막으로 끝낸 고유번호(오름차순 진행).
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CORP_CODE = /^\d{8}$/;

export interface DartPendingCorp {
    corpCode: string;
    /** 일시 오류로 실패한 횟수. */
    attempts: number;
}

export interface DartListCursor {
    through: string | null;
    pending: readonly DartPendingCorp[];
}

export interface DartBackfillCursor {
    afterCorpCode: string | null;
}

export const EMPTY_DART_LIST_CURSOR: DartListCursor = {
    through: null,
    pending: [],
};

export const EMPTY_DART_BACKFILL_CURSOR: DartBackfillCursor = {
    afterCorpCode: null,
};

function parseObject(raw: string | null): Record<string, unknown> | null {
    if (raw === null) return null;
    try {
        const value: unknown = JSON.parse(raw);
        // 안전한 단언: 바로 위에서 null·배열이 아닌 object임을 확인했고, 값은 아래에서 필드마다 다시 검사한다.
        return typeof value === 'object' &&
            value !== null &&
            !Array.isArray(value)
            ? (value as Record<string, unknown>)
            : null;
    } catch {
        return null;
    }
}

function parsePending(value: unknown): DartPendingCorp[] {
    if (!Array.isArray(value)) return [];
    const entries = value.flatMap((entry): DartPendingCorp[] => {
        if (typeof entry !== 'object' || entry === null) return [];
        const corpCode = 'corpCode' in entry ? entry.corpCode : undefined;
        const attempts = 'attempts' in entry ? entry.attempts : undefined;
        if (typeof corpCode !== 'string' || !CORP_CODE.test(corpCode)) {
            return [];
        }
        return [
            {
                corpCode,
                attempts:
                    typeof attempts === 'number' &&
                    Number.isInteger(attempts) &&
                    attempts >= 0
                        ? attempts
                        : 0,
            },
        ];
    });
    return mergePending(entries, []);
}

/**
 * 대기열 둘을 합친다 — 고유번호별 하나, 순서는 `first` 다음 `second`(처음 나온 자리), 시도 횟수는 큰 쪽.
 */
export function mergePending(
    first: readonly DartPendingCorp[],
    second: readonly DartPendingCorp[]
): DartPendingCorp[] {
    const merged = [...first, ...second].reduce((byCorp, entry) => {
        const previous = byCorp.get(entry.corpCode);
        return byCorp.set(entry.corpCode, {
            corpCode: entry.corpCode,
            attempts: Math.max(previous?.attempts ?? 0, entry.attempts),
        });
    }, new Map<string, DartPendingCorp>());
    return [...merged.values()];
}

/** `dart_list_cursor` 저장 문자열 → 상태. */
export function parseDartListCursor(raw: string | null): DartListCursor {
    const value = parseObject(raw);
    if (value === null) return EMPTY_DART_LIST_CURSOR;
    const through =
        typeof value.through === 'string' && ISO_DATE.test(value.through)
            ? value.through
            : null;
    return { through, pending: parsePending(value.pending) };
}

export function serializeDartListCursor(cursor: DartListCursor): string {
    return JSON.stringify({
        through: cursor.through,
        pending: cursor.pending,
    });
}

/** `dart_backfill_cursor` 저장 문자열 → 상태. */
export function parseDartBackfillCursor(
    raw: string | null
): DartBackfillCursor {
    const value = parseObject(raw);
    if (value === null) return EMPTY_DART_BACKFILL_CURSOR;
    return {
        afterCorpCode:
            typeof value.afterCorpCode === 'string' &&
            CORP_CODE.test(value.afterCorpCode)
                ? value.afterCorpCode
                : null,
    };
}

export function serializeDartBackfillCursor(
    cursor: DartBackfillCursor
): string {
    return JSON.stringify({ afterCorpCode: cursor.afterCorpCode });
}
