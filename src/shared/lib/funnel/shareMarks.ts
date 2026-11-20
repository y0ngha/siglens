import { kstDateKey } from '@/shared/lib/etTimeUtils';
import { LOCAL_STORAGE_SHARE_MARKS_KEY } from '@/shared/lib/storageKeys';

/** 이 브라우저가 만든 공유 id를 기억하는 최대 개수(가장 최근 것부터). */
export const SHARE_MARKS_MAX_CREATED = 20;

interface ShareMarks {
    created: string[];
    opened: { date: string; ids: string[] };
}

function emptyMarks(): ShareMarks {
    return { created: [], opened: { date: '', ids: [] } };
}

/** 저장소가 막힌 브라우저용 — 페이지 수명 동안만 중복을 막는다. */
const memoryFallback: ShareMarks = emptyMarks();

function isStringArray(value: unknown): value is string[] {
    return (
        Array.isArray(value) && value.every(item => typeof item === 'string')
    );
}

function isMarks(value: unknown): value is ShareMarks {
    if (typeof value !== 'object' || value === null) return false;
    const record = value as Partial<ShareMarks>;
    const opened = record.opened as Partial<ShareMarks['opened']> | undefined;
    return (
        isStringArray(record.created) &&
        typeof opened === 'object' &&
        opened !== null &&
        typeof opened.date === 'string' &&
        isStringArray(opened.ids)
    );
}

function parseJson(raw: string): unknown {
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

/** 오늘(KST)이 아닌 날의 `opened` 목록은 읽는 순간 버린다 — "오늘 연 링크"만 남긴다. */
function dropStaleOpened(marks: ShareMarks, date: string): ShareMarks {
    return marks.opened.date === date
        ? marks
        : { ...marks, opened: { date, ids: [] } };
}

/**
 * 읽기·쓰기를 저장소에 하고, 막히면 메모리로 물러난다. 던지지 않는다. 낡은 `opened`는 읽을 때 버리고,
 * 바꿀 것이 없어도(`change`가 `null`) 버린 결과를 저장소에 되돌려 쓴다.
 */
function update(
    date: string,
    change: (marks: ShareMarks) => ShareMarks | null
): boolean {
    try {
        const raw = window.localStorage.getItem(LOCAL_STORAGE_SHARE_MARKS_KEY);
        const parsed = raw === null ? null : parseJson(raw);
        const stored = isMarks(parsed) ? parsed : emptyMarks();
        const current = dropStaleOpened(stored, date);
        const next = change(current);
        const toWrite = next ?? current;
        if (next !== null || current !== stored) {
            window.localStorage.setItem(
                LOCAL_STORAGE_SHARE_MARKS_KEY,
                JSON.stringify(toWrite)
            );
        }
        return next !== null;
    } catch {
        const current = dropStaleOpened(memoryFallback, date);
        const next = change(current);
        const toKeep = next ?? current;
        memoryFallback.created = toKeep.created;
        memoryFallback.opened = toKeep.opened;
        return next !== null;
    }
}

/**
 * 이 브라우저가 이 공유 id를 처음 만들었는가. 처음이면 기억하고(최근 20개만 둔다) `true`.
 *
 * 서버는 같은 내용이면 같은 id를 돌려주므로, 바뀌지 않은 분석을 다시 공유해도 한 번만 센다.
 * 저장소가 막혀 있으면 페이지 수명 메모리로 물러난다 — 던지지 않는다.
 */
export function claimShareCreated(id: string, now: Date = new Date()): boolean {
    return update(kstDateKey(now), marks =>
        marks.created.includes(id)
            ? null
            : {
                  ...marks,
                  created: [...marks.created, id].slice(
                      -SHARE_MARKS_MAX_CREATED
                  ),
              }
    );
}

/**
 * 이 공유 링크 열람을 `share_opened`로 셀 것인가. 이 브라우저가 만든 링크(자기 열람)이거나 오늘(KST)
 * 이미 연 링크면 `false`, 아니면 기억하고 `true`.
 */
export function claimShareOpened(id: string, now: Date = new Date()): boolean {
    const date = kstDateKey(now);
    return update(date, marks => {
        if (marks.created.includes(id)) return null;
        if (marks.opened.ids.includes(id)) return null;
        return { ...marks, opened: { date, ids: [...marks.opened.ids, id] } };
    });
}
