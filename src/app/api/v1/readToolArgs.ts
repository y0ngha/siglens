import { PUBLIC_API_MAX_BODY_CHARS } from '@/shared/config/publicApi';
import { apiError, API_STATUS } from './apiResponse';

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

/**
 * 도구 인자 본문을 읽는다: 크기 → 파싱 → 모양 순(SERVER.md#SA-7). 본문이 비어 있으면 `{}`
 * (인자 없는 도구용). 배열·원시값·`null`은 거절한다 — 인자 객체만 받는다.
 */
export async function readToolArgs(request: Request): Promise<ToolArgsOutcome> {
    const declared = Number(request.headers.get('content-length') ?? 0);
    if (Number.isFinite(declared) && declared > PUBLIC_API_MAX_BODY_CHARS * 4)
        return tooLarge();
    const text = await request.text();
    if (text.length > PUBLIC_API_MAX_BODY_CHARS) return tooLarge();
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
