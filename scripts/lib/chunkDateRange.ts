/** [from,to] 날짜 청크 — 둘 다 'YYYY-MM-DD', 경계 포함. */
export interface DateChunk {
    from: string;
    to: string;
}

function addDays(dateEt: string, delta: number): string {
    const [y, m, d] = dateEt.split('-').map(Number);
    const shifted = new Date(Date.UTC(y, m - 1, d + delta));
    return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
}

/**
 * `[start, end]`(경계 포함)을 최대 `chunkDays`일 길이의 연속·비중첩 청크로 분할한다.
 * 마지막 청크의 `to`는 전체 `end`로 클램프된다. 백필이 FMP를 작은 슬라이스로 호출해
 * per-request 페이로드를 제한하고 부분 실패 시 작은 범위만 재시도하기 위함.
 */
export function chunkDateRange(
    start: string,
    end: string,
    chunkDays: number
): DateChunk[] {
    if (chunkDays < 1) throw new RangeError('chunkDays must be >= 1');
    const chunks: DateChunk[] = [];
    let cursor = start;
    while (cursor <= end) {
        const candidateEnd = addDays(cursor, chunkDays);
        const to = candidateEnd > end ? end : candidateEnd;
        chunks.push({ from: cursor, to });
        cursor = addDays(to, 1);
    }
    return chunks;
}
