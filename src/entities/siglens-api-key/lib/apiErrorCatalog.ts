/**
 * 공개 API(`/api/v1/*`)가 내는 오류 코드의 문서용 목록 — OpenAPI 문서와 `/developers` 화면이
 * 함께 읽는다. 상태와 코드는 라우트·실행기가 실제로 내는 값(`src/app/api/v1`)과 같아야 하고, 이
 * 파일은 그 값을 **서술**할 뿐 응답을 만들지 않는다(응답은 라우트가 만든다).
 *
 * `message`는 영어 고정 외부 계약이고(`apiResponse.ts`), 여기 `summary`는 문서 독자를 위한 설명이다.
 */

/** 이 오류가 나올 수 있는 엔드포인트 범위. */
export type ApiErrorScope =
    /** 인증을 거치는 모든 엔드포인트. */
    | 'all'
    /** `POST /tools/{name}`(모든 도구). */
    | 'tools'
    /** `run_fresh_analysis`만. */
    | 'fresh-analysis';

export interface ApiErrorDoc {
    readonly code: string;
    /** HTTP 상태. 스트리밍 응답(`200`) 본문 안의 오류도 같은 코드를 쓰며, 그때의 상태는 `streamed`로 알린다. */
    readonly status: number;
    readonly scope: ApiErrorScope;
    /**
     * `run_fresh_analysis`에서만: 스트리밍 생성이 시작된 뒤에는 이 오류가 HTTP 200 본문의 `error`로 나간다.
     * 다른 도구는 항상 일반 상태 코드이므로 이 표지를 문서의 다른 도구 응답에 옮기지 않는다.
     */
    readonly streamed?: true;
    readonly summary: string;
}

export const API_ERROR_DOCS: readonly ApiErrorDoc[] = [
    {
        code: 'invalid_api_key',
        status: 401,
        scope: 'all',
        summary:
            'The Authorization header is missing, malformed, or names a revoked, unknown or unverified key. The response carries WWW-Authenticate: Bearer.',
    },
    {
        code: 'service_unavailable',
        status: 503,
        scope: 'all',
        summary:
            'Authentication or account data is temporarily unavailable. Retry after the Retry-After seconds.',
    },
    {
        code: 'rate_limited',
        status: 429,
        scope: 'all',
        summary:
            'A rate limit was exceeded. Wait for the Retry-After seconds. The X-RateLimit-* headers show the window that was exceeded.',
    },
    {
        code: 'rate_limiter_unavailable',
        status: 503,
        scope: 'all',
        summary:
            'The rate limiter is temporarily unavailable. Requests are refused rather than left unlimited. Retry after the Retry-After seconds.',
    },
    {
        code: 'internal_error',
        status: 500,
        scope: 'all',
        summary: 'Unexpected server error.',
    },
    {
        code: 'unknown_tool',
        status: 404,
        scope: 'tools',
        summary: 'No such tool. GET /tools lists the tools that can be called.',
    },
    {
        code: 'invalid_body',
        status: 400,
        scope: 'tools',
        summary: 'The request body is not valid JSON, or is not a JSON object.',
    },
    {
        code: 'body_too_large',
        status: 413,
        scope: 'tools',
        summary: 'The request body is over the size limit.',
    },
    {
        code: 'invalid_args',
        status: 400,
        scope: 'tools',
        summary:
            'The arguments do not match the tool schema. error.details.issues lists what is wrong when the schema check fails.',
    },
    {
        code: 'invalid_symbol',
        status: 400,
        scope: 'tools',
        summary: 'A symbol argument is not a valid ticker shape.',
    },
    {
        code: 'invalid_query',
        status: 400,
        scope: 'tools',
        summary: 'The query argument is empty or invalid.',
    },
    {
        code: 'login_required',
        status: 403,
        scope: 'tools',
        summary: 'This tool needs a member account.',
    },
    {
        code: 'timeframe_not_allowed',
        status: 403,
        scope: 'tools',
        summary:
            'get_chart_data only: the timeframe is not open to the account tier, the same rule as the website chart. error.details lists tier and allowedTimeframes.',
    },
    {
        code: 'bars_not_found',
        status: 404,
        scope: 'tools',
        summary:
            'get_chart_data only: no price bars exist for this symbol and timeframe.',
    },
    {
        code: 'stale_listing',
        status: 404,
        scope: 'tools',
        summary:
            'A Korean listing has not traded for more than about 10 trading days (often the wrong .KS/.KQ suffix), so no current price is served. error.details.lastTradeDate is the last trade date; check the symbol with search_ticker.',
    },
    {
        code: 'tool_timeout',
        status: 504,
        scope: 'tools',
        streamed: true,
        summary: 'The tool did not finish before its deadline.',
    },
    {
        code: 'aborted',
        status: 504,
        scope: 'tools',
        summary: 'The request ended before the tool finished.',
    },
    {
        code: 'tool_failed',
        status: 500,
        scope: 'tools',
        streamed: true,
        summary: 'The tool failed to produce a result.',
    },
    {
        code: 'model_required',
        status: 400,
        scope: 'fresh-analysis',
        summary:
            'No model argument was sent and no API default model is set at siglens.io/account.',
    },
    {
        code: 'invalid_model',
        status: 400,
        scope: 'fresh-analysis',
        summary: 'The model is not a known model.',
    },
    {
        code: 'byok_key_required',
        status: 400,
        scope: 'fresh-analysis',
        summary:
            'No cached analysis exists and generating one needs your own key. error.details.provider is the provider whose key you must register at siglens.io/account.',
    },
    {
        code: 'busy',
        status: 503,
        scope: 'fresh-analysis',
        summary:
            'The server is running the maximum number of analyses. Retry after the Retry-After seconds.',
    },
    {
        code: 'analysis_failed',
        status: 422,
        scope: 'fresh-analysis',
        streamed: true,
        summary:
            'The analysis could not be produced. error.details.code says why (for example no_news).',
    },
    {
        code: 'provider_error',
        status: 502,
        scope: 'fresh-analysis',
        streamed: true,
        summary:
            'Your LLM provider rejected the request or kept failing. error.details has provider and status. Check the key, quota and model access, or retry later.',
    },
];
