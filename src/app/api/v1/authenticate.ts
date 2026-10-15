import { authenticateApiKey } from '@/entities/siglens-api-key/server/apiKeyAuth';
import type { ApiKeyPrincipal } from '@/entities/siglens-api-key/model';
import { apiError, API_STATUS } from './apiResponse';

/** 키 저장소 장애 시 클라이언트가 기다릴 초. */
const AUTH_UNAVAILABLE_RETRY_SECONDS = 30;

export type AuthOutcome =
    | { ok: true; principal: ApiKeyPrincipal }
    | { ok: false; response: Response };

/**
 * `Authorization: Bearer slk_...`만 본다. 세션 쿠키는 읽지 않는다 — 브라우저 세션이 있는
 * 요청이 키 없이 통과하는 경로를 만들지 않기 위해서다. 실패 사유(형식·없는 키·폐기·미인증)는
 * 구분하지 않고 같은 401을 낸다.
 */
export async function requireApiKey(request: Request): Promise<AuthOutcome> {
    const result = await authenticateApiKey(
        request.headers.get('authorization')
    );
    if (result.status === 'ok')
        return { ok: true, principal: result.principal };
    if (result.status === 'unavailable')
        return {
            ok: false,
            response: apiError(
                API_STATUS.serviceUnavailable,
                'service_unavailable',
                'Authentication is temporarily unavailable. Retry shortly.',
                {
                    headers: {
                        'Retry-After': String(AUTH_UNAVAILABLE_RETRY_SECONDS),
                    },
                }
            ),
        };
    return {
        ok: false,
        response: apiError(
            API_STATUS.unauthorized,
            'invalid_api_key',
            'Missing, malformed, revoked or unknown API key.',
            { headers: { 'WWW-Authenticate': 'Bearer' } }
        ),
    };
}
