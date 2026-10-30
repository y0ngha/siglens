import { PUBLIC_API_MAX_BODY_CHARS } from '@/shared/config/publicApi';
import { apiError, API_STATUS } from './apiResponse';

/** 본문 읽기 결과 — 인자 객체 또는 413/400 응답. */
export type ToolArgsOutcome =
    | { ok: true; args: Record<string, unknown> }
    | { ok: false; response: Response };

const tooLarge = (): ToolArgsOutcome => ({
    ok: false,
    response: apiError(
        API_STATUS.payloadTooLarge,
        'body_too_large',
        `The request body exceeds ${PUBLIC_API_MAX_BODY_CHARS} characters.`
    ),
});

const invalidBody = (message: string): ToolArgsOutcome => ({
    ok: false,
    response: apiError(API_STATUS.badRequest, 'invalid_body', message),
});

/** UTF-8은 문자당 최대 4바이트라, 이만큼 넘게 받으면 문자 상한도 반드시 넘는다. */
const MAX_BODY_BYTES = PUBLIC_API_MAX_BODY_CHARS * 4;

/**
 * 본문을 청크 단위로 읽으며 상한을 넘는 즉시 스트림을 취소한다. `request.text()`는 Content-Length
 * 없는(chunked) 요청에서 전부 읽은 뒤에야 크기를 볼 수 있어, 크기 검사가 파싱보다 앞서야 한다는
 * 규칙(SERVER.md#SA-7)이 메모리에서 무너진다. 상한 초과면 `null`.
 */
async function readBodyWithinLimit(request: Request): Promise<string | null> {
    if (request.body === null) return '';
    const reader = request.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0;
    let text = '';
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        text += decoder.decode(value, { stream: true });
        if (bytes > MAX_BODY_BYTES || text.length > PUBLIC_API_MAX_BODY_CHARS) {
            await reader.cancel();
            return null;
        }
    }
    text += decoder.decode();
    return text.length > PUBLIC_API_MAX_BODY_CHARS ? null : text;
}

/**
 * 도구 인자 본문을 읽는다: 크기 → 파싱 → 모양 순(SERVER.md#SA-7). 본문이 비어 있으면 `{}`
 * (인자 없는 도구용). 배열·원시값·`null`은 거절한다 — 인자 객체만 받는다.
 */
export async function readToolArgs(request: Request): Promise<ToolArgsOutcome> {
    const declared = Number(request.headers.get('content-length') ?? 0);
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES)
        return tooLarge();
    const text = await readBodyWithinLimit(request);
    if (text === null) return tooLarge();
    if (text.trim() === '') return { ok: true, args: {} };
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return invalidBody('The request body is not valid JSON.');
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
        return invalidBody('The request body must be a JSON object.');
    return { ok: true, args: parsed as Record<string, unknown> };
}
