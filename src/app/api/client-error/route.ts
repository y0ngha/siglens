/**
 * 클라이언트 예외 수집 엔드포인트. 하는 일은 로그 한 줄 남기고 204를 돌려주는 것뿐이다 —
 * 집계·알람은 CloudWatch 메트릭 필터(`[client-error]`)가 담당한다.
 *
 * DB도 Redis도 타지 않는다. 사고 중에 이 경로가 실패하면 사고 자체가 안 보인다.
 */
export const dynamic = 'force-dynamic';

/** `reportClientError`가 스택을 1200자로 자르므로 정상 페이로드는 이 한참 아래다. */
const MAX_BODY_BYTES = 4096;

/**
 * 본문을 `cap` 바이트까지만 읽고, 넘으면 스트림을 끊고 `null`을 돌려준다.
 *
 * `request.text()`를 그냥 쓰면 안 된다. 인증 없는 공개 엔드포인트이고, `content-length`는
 * **믿을 수 없다** — 헤더가 없으면(`Transfer-Encoding: chunked`, HTTP/2) `Number(null)`이
 * `0`이라 어떤 상한 검사도 통과한다. 그 상태로 `text()`를 부르면 임의 크기 본문이
 * 전부 메모리로 들어온다. 읽은 뒤 자르는 건 로그만 줄일 뿐 이미 늦었다.
 */
async function readCapped(
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

export async function POST(request: Request): Promise<Response> {
    // 정직한 클라이언트는 여기서 걸러진다(스트림을 열지도 않는다).
    const declared = Number(request.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
        return new Response(null, { status: 204 });
    }

    const raw = await readCapped(request, MAX_BODY_BYTES);
    if (raw === null || raw === '') return new Response(null, { status: 204 });

    // 개행을 반드시 지운다. awslogs 드라이버는 stdout을 개행으로 쪼개 **줄마다** 로그
    // 이벤트를 만들고, CloudWatch 메트릭 필터는 그 줄들을 그대로 센다. 즉 인증 없는 이
    // 엔드포인트에 `x\nJavaScript heap out of memory`를 보내면 `siglens-node-heap-oom`
    // (P1, threshold 0)이 그대로 발동한다 — `[analysis-stream] failed`,
    // `[isr-cache] s3 get failed`도 같은 방식으로 위조된다.
    // 정상 본문은 한 줄짜리 JSON이라 잃는 게 없다.
    console.error('[client-error]', raw.replace(/[\r\n]+/g, ' '));
    return new Response(null, { status: 204 });
}
