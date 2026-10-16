import { constants } from 'node:http2';
import { isPublicApiEnabled } from '@/shared/api/publicApiEnabled';

const {
    HTTP_STATUS_BAD_REQUEST,
    HTTP_STATUS_UNAUTHORIZED,
    HTTP_STATUS_NOT_FOUND,
    HTTP_STATUS_UNPROCESSABLE_ENTITY,
    HTTP_STATUS_BAD_GATEWAY,
    HTTP_STATUS_PAYLOAD_TOO_LARGE,
    HTTP_STATUS_TOO_MANY_REQUESTS,
    HTTP_STATUS_INTERNAL_SERVER_ERROR,
    HTTP_STATUS_SERVICE_UNAVAILABLE,
    HTTP_STATUS_GATEWAY_TIMEOUT,
    HTTP_STATUS_FORBIDDEN,
} = constants;

/**
 * 모든 v1 응답에 붙는다. 응답이 키별·회원별이고 Cloudflare 캐시 규칙이 `/api`를 제외하더라도
 * 규칙이 바뀔 때를 위해 헤더로도 막는다(공유 캐시에 키 소유자의 데이터가 남으면 안 된다).
 */
const NO_STORE_CACHE_CONTROL = 'no-store';

export type ApiErrorCode =
    | 'invalid_api_key'
    | 'invalid_body'
    | 'body_too_large'
    | 'invalid_args'
    | 'unknown_tool'
    | 'rate_limited'
    | 'rate_limiter_unavailable'
    | 'service_unavailable'
    | 'tool_timeout'
    | 'tool_failed'
    | 'internal_error'
    | (string & {});

export interface ApiMeta {
    tool?: string;
    /** 결과가 크기 상한에 걸려 `{ truncated, preview }`로 접혔다. 접히지 않았으면 키 자체가 없다. */
    truncated?: true;
    /** 분석 도구만: 공유 캐시 적중(`cache`)인지 사용자 키로 새로 만들었는지(`fresh`). */
    source?: 'cache' | 'fresh';
    /** 분석 도구만: 실제로 쓴(또는 캐시를 읽은) 모델. */
    model?: string;
}

export function apiJson(
    status: number,
    body: unknown,
    headers?: HeadersInit
): Response {
    const merged = new Headers(headers);
    merged.set('Cache-Control', NO_STORE_CACHE_CONTROL);
    return Response.json(body, { status, headers: merged });
}

/** 성공 본문 `{ data, meta }` — 일반 응답과 스트리밍 응답이 같은 모양을 쓴다. */
export function okBody(data: unknown, meta: ApiMeta = {}): unknown {
    return { data, meta };
}

export function apiOk(
    data: unknown,
    meta: ApiMeta = {},
    headers?: HeadersInit
): Response {
    return apiJson(200, okBody(data, meta), headers);
}

/**
 * 공개 문서 파일(`openapi.json`·`openapi.yaml`·`skill`)에 거는 `X-Robots-Tag: noindex`. **이중 방어다.**
 * `robots.txt`가 `/api/`를 막으므로 규약을 지키는 크롤러는 이 응답을 받지 않는다 — 그쪽 차단은 그대로 둔다.
 * 이 헤더는 robots.txt를 무시하고 URL을 직접 가져가는 fetcher·스크레이퍼가 받아 가 색인 대상으로 삼지
 * 않게 하는 보조 신호일 뿐이다(사람이 읽는 문서는 `/developers`다). 응답을 읽는 쪽(브라우저·도구·사용자 요청
 * fetcher)의 동작에는 영향이 없다. 오류 응답에도 같이 건다.
 */
export const PUBLIC_API_DOC_ROBOTS_HEADERS: Readonly<Record<string, string>> = {
    'X-Robots-Tag': 'noindex',
};

/** 실패 본문 `{ error: { code, message, details? } }`. message는 외부 API라 영어 고정이다. */
export function errorBody(
    code: ApiErrorCode,
    message: string,
    details?: unknown
): unknown {
    return {
        error: {
            code,
            message,
            ...(details === undefined ? {} : { details }),
        },
    };
}

export function apiError(
    status: number,
    code: ApiErrorCode,
    message: string,
    options: { headers?: HeadersInit; details?: unknown } = {}
): Response {
    return apiJson(
        status,
        errorBody(code, message, options.details),
        options.headers
    );
}

export const API_STATUS = {
    badRequest: HTTP_STATUS_BAD_REQUEST,
    unauthorized: HTTP_STATUS_UNAUTHORIZED,
    forbidden: HTTP_STATUS_FORBIDDEN,
    notFound: HTTP_STATUS_NOT_FOUND,
    unprocessable: HTTP_STATUS_UNPROCESSABLE_ENTITY,
    badGateway: HTTP_STATUS_BAD_GATEWAY,
    payloadTooLarge: HTTP_STATUS_PAYLOAD_TOO_LARGE,
    tooManyRequests: HTTP_STATUS_TOO_MANY_REQUESTS,
    internalError: HTTP_STATUS_INTERNAL_SERVER_ERROR,
    serviceUnavailable: HTTP_STATUS_SERVICE_UNAVAILABLE,
    gatewayTimeout: HTTP_STATUS_GATEWAY_TIMEOUT,
} as const;

/**
 * 핸들러 최상단 경계. 예기치 못한 throw가 Next 기본 오류 페이지(HTML)로 새지 않게
 * 같은 `{ error }` 모양의 500으로 바꾼다. 내부 오류 상세는 응답에 싣지 않는다.
 */
export async function withApiErrorBoundary(
    label: string,
    handler: () => Promise<Response>
): Promise<Response> {
    // 출시 플래그가 꺼져 있으면 인증·한도·DB보다 먼저 끊는다. 모든 v1 라우트가 이 경계를 거치므로
    // 새 라우트도 우회하지 못한다(`publicApiLaunchFlag.route.test.ts`가 라우트 파일을 전수 검사한다).
    if (!isPublicApiEnabled())
        return apiError(API_STATUS.notFound, 'not_found', 'Not found.');
    try {
        return await handler();
    } catch (error) {
        console.error(`[api/v1/${label}] unexpected error:`, error);
        return apiError(
            API_STATUS.internalError,
            'internal_error',
            'Unexpected server error.'
        );
    }
}
