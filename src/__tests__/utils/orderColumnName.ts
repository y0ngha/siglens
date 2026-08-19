/**
 * drizzle `desc(col)` 노드에서 컬럼 이름을 뽑는다 — 리터럴 조각(`' desc'`)만으로는
 * 어느 컬럼인지 구분할 수 없다.
 */
export function orderColumnName(node: unknown): string {
    const chunks = (node as { queryChunks?: unknown[] }).queryChunks ?? [];
    let name = '?';
    let direction = '?';
    for (const c of chunks) {
        const chunk = c as { name?: unknown; value?: unknown };
        if (typeof chunk.name === 'string') name = chunk.name;
        // 방향은 마지막 StringChunk에 `[' desc']` 형태로 들어 있다. 이름만 보면
        // desc→asc 뮤테이션이 그대로 통과한다 — 그러면 "앞이 최신"이라는 전제가
        // 뒤집혀 상한 slice가 **가장 오래된** 행을 남긴다(감사: 라운드 4 P1).
        const [literal] = Array.isArray(chunk.value) ? chunk.value : [];
        if (typeof literal === 'string' && literal.trim() !== '') {
            direction = literal.trim();
        }
    }
    return `${name} ${direction}`;
}
