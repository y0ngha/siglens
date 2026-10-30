/**
 * 본문을 `cap` 바이트까지만 읽고, 넘거나 읽기에 실패하면 스트림을 끊고 `null`을 돌려준다.
 * 본문이 없으면 빈 문자열이다.
 *
 * `request.text()`를 그냥 쓰면 안 된다. 인증 없는 공개 엔드포인트이고, `content-length`는
 * **믿을 수 없다** — 헤더가 없으면(`Transfer-Encoding: chunked`, HTTP/2) `Number(null)`이
 * `0`이라 어떤 상한 검사도 통과한다. 그 상태로 `text()`를 부르면 임의 크기 본문이
 * 전부 메모리로 들어온다. 읽은 뒤 자르는 건 로그만 줄일 뿐 이미 늦었다.
 */
export async function readCappedBody(
    request: Request,
    cap: number
): Promise<string | null> {
    const body = request.body;
    if (body === null) return '';

    const reader = body.getReader();
    const decoder = new TextDecoder();
    let out = '';
    let total = 0;
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            total += value.byteLength;
            if (total > cap) {
                await reader.cancel();
                return null;
            }
            out += decoder.decode(value, { stream: true });
        }
        return out + decoder.decode();
    } catch {
        return null;
    }
}
