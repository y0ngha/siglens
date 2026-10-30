/** 라우트·fetch 테스트가 돌려줄 JSON `Response` — `content-type`을 함께 심어 `res.json()` 소비자가 그대로 읽는다. */
export function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
    });
}
