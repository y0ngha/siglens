import { isDispatchedType } from './dispatch';
import type {
    DispatchParams,
    ParsedStreamBody,
    TechnicalParams,
} from './types';

/** 본문 검증 결과 — 통과하면 종류별로 가른 본문, 실패하면 라우트가 그대로 돌려줄 400 응답. */
export type StreamBodyOutcome =
    | { ok: true; body: ParsedStreamBody }
    | { ok: false; response: Response };

const badRequest = (message: string): StreamBodyOutcome => ({
    ok: false,
    response: Response.json({ error: message }, { status: 400 }),
});

function isParamsObject(value: unknown): value is object {
    return value != null && typeof value === 'object';
}

/**
 * 요청 본문을 읽어 종류별로 가른다: JSON 파싱 → 본문이 객체인지 → `params`가 객체인지 → 지원하는
 * 종류인지 순. 핸들러가 `params`를 곧바로 구조분해하므로, 여기서 거르지 않으면 `{"type":"technical"}`
 * 같은 입력이 처리되지 않은 throw로 500이 된다 — 400이어야 한다.
 *
 * `technical`의 `params` 필드(symbol·timeframe 등)는 좁히지 않는다. 게이트·core가 검증하고,
 * 잘못된 값은 라우트의 catch가 500 sentinel로 받는다(예약한 한도는 환불된다).
 */
export async function parseStreamBody(
    request: Request
): Promise<StreamBodyOutcome> {
    let raw: unknown;
    try {
        raw = await request.json();
    } catch {
        return badRequest('invalid JSON');
    }
    // `null`은 유효한 JSON이지만 아래에서 `.type`을 읽다 TypeError가 난다.
    if (raw === null || typeof raw !== 'object')
        return badRequest('request body must be a JSON object');
    const type: unknown = Reflect.get(raw, 'type');
    const params: unknown = Reflect.get(raw, 'params');

    if (type === 'technical') {
        if (!isParamsObject(params))
            return badRequest('technical requires a params object');
        // 캐스트 근거: 필드별 검증은 게이트·core 몫이다(위 JSDoc).
        return {
            ok: true,
            body: { kind: 'technical', params: params as TechnicalParams },
        };
    }
    if (!isParamsObject(params)) return badRequest('params must be an object');
    if (!isDispatchedType(type))
        return badRequest(`unsupported analysis type: ${String(type)}`);
    return {
        ok: true,
        body: { kind: 'dispatch', type, params: params as DispatchParams },
    };
}
