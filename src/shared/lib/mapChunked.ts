/**
 * `items`를 `size`개씩 순서대로 처리한다 — 결과 순서는 입력 순서.
 *
 * 청크를 직렬로 돌리는 이유: 한 번에 떠 있는 작업을 `size`개로 묶기 위해서다(외부 공급자 호출 상한).
 * reduce가 프라미스 체인을 만들어 앞 청크가 끝나야 다음 청크의 `work`가 시작된다. 한 청크 안에서
 * `work`가 던지면 그 거절이 그대로 전파되므로, 항목별 실패를 삼켜야 하면 `work` 안에서 처리한다.
 */
export function mapChunked<T, R>(
    items: readonly T[],
    size: number,
    work: (item: T) => Promise<R>
): Promise<R[]> {
    const chunks = Array.from(
        { length: Math.ceil(items.length / size) },
        (_, i) => items.slice(i * size, (i + 1) * size)
    );
    return chunks.reduce<Promise<R[]>>(
        (previous, chunk) =>
            previous.then(done =>
                Promise.all(chunk.map(work)).then(rows => [...done, ...rows])
            ),
        Promise.resolve([])
    );
}
