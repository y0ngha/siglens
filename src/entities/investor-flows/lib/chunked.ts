/** 배열을 `size`개씩 순서대로 자른다 — DB 쓰기·조회를 청크로 나눌 때 쓴다. 빈 입력은 빈 배열. */
export function chunked<T>(items: readonly T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
        items.slice(index * size, (index + 1) * size)
    );
}
