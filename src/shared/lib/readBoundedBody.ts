/** 본문이 상한을 넘었다. 메시지에 URL을 넣지 않는다 — 호출부가 비밀값이 든 URL을 쓸 수 있다(DART `crtfc_key`). */
export class BoundedBodyTooLargeError extends Error {
    readonly maxBytes: number;

    constructor(maxBytes: number) {
        super(`response body exceeds ${maxBytes} bytes`);
        this.name = 'BoundedBodyTooLargeError';
        this.maxBytes = maxBytes;
    }
}

/** 청크 배열을 하나의 바이트 배열로 잇는다. */
function concatChunks(
    chunks: readonly Uint8Array[],
    total: number
): Uint8Array {
    const out = new Uint8Array(total);
    chunks.reduce((offset, chunk) => {
        out.set(chunk, offset);
        return offset + chunk.byteLength;
    }, 0);
    return out;
}

/** 스트림의 청크를 차례로 흘린다 — 소비자가 멈추면(break·throw) 스트림을 취소한다. */
async function* chunksOf(
    body: ReadableStream<Uint8Array>
): AsyncGenerator<Uint8Array> {
    const reader = body.getReader();
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) return;
            yield value;
        }
    } finally {
        reader.cancel().catch(() => undefined);
    }
}

/**
 * 응답 본문을 `maxBytes`까지만 모아 돌려준다(SERVER.md#SA-7) — `Content-Length`가 상한을 넘으면 **읽기 전에**, 선언 없이 길게
 * 오면 상한에 닿는 순간 스트림을 끊고 `BoundedBodyTooLargeError`를 던진다(본문 전체를 메모리에 올린 뒤 길이를 재지 않는다).
 *
 * 시간 상한은 걸지 않는다 — 호출부가 `fetch`에 넘긴 `signal`(`AbortSignal.timeout`)이 본문 스트림까지 끊는다(undici는 요청
 * signal이 abort되면 진행 중인 본문 읽기도 실패시킨다).
 */
export async function readBoundedBody(
    res: Response,
    maxBytes: number
): Promise<Uint8Array> {
    const declared = Number(res.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > maxBytes) {
        await res.body?.cancel().catch(() => undefined);
        throw new BoundedBodyTooLargeError(maxBytes);
    }
    if (res.body === null) return new Uint8Array(0);
    // 순차 스트림 누적(CONVENTIONS.md#CP-6 예외): 청크를 배열에 모아 끝에서 한 번 잇는다 — 청크마다 새 배열로 이어 붙이면
    // O(N²) 복사가 되고, 상한 검사 덕에 모이는 바이트는 `maxBytes`로 묶인다.
    const chunks: Uint8Array[] = [];
    let total = 0;
    for await (const chunk of chunksOf(res.body)) {
        total += chunk.byteLength;
        if (total > maxBytes) throw new BoundedBodyTooLargeError(maxBytes);
        chunks.push(chunk);
    }
    return concatChunks(chunks, total);
}
