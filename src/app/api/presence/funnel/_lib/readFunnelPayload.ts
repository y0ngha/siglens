import {
    FUNNEL_BODY_MAX_BYTES,
    isFunnelEventPayload,
    type FunnelEventPayload,
} from '@/shared/lib/funnel/funnelEvents';

/**
 * 순서는 타입 → 크기 → 파싱(`SERVER.md#SA-7`). 본문이 상한을 넘으면 `JSON.parse` 전에
 * 거른다. 카탈로그 밖의 event·여분 키·잘못된 enum은 `isFunnelEventPayload`가 거부한다.
 * 어느 단계든 실패하면 `null`이다(호출부가 400으로 답한다).
 */
export async function readFunnelPayload(
    request: Request
): Promise<FunnelEventPayload | null> {
    // 선언된 길이로 먼저 거른다 — 본문을 메모리에 올리기 전에 끊는다. 헤더는 거짓일 수 있어
    // 아래 바이트 검사는 그대로 둔다(백스톱).
    const declared = Number(request.headers.get('content-length'));
    if (declared > FUNNEL_BODY_MAX_BYTES) return null;
    try {
        const text = await request.text();
        if (Buffer.byteLength(text, 'utf8') > FUNNEL_BODY_MAX_BYTES)
            return null;
        const body: unknown = JSON.parse(text);
        return isFunnelEventPayload(body) ? body : null;
    } catch {
        return null;
    }
}
