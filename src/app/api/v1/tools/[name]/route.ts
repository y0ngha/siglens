import { validateArgs } from '@y0ngha/siglens-core';
import {
    apiError,
    apiOk,
    API_STATUS,
    errorBody,
    okBody,
    withApiErrorBoundary,
} from '../../apiResponse';
import { streamingJsonResponse } from '../../apiStream';
import { isPublicToolStream } from '../../publicToolOutcome';
import { requireApiKey } from '../../authenticate';
import { executePublicTool, resolveApiLocale } from '../../executePublicTool';
import { findPublicApiToolSpec } from '../../publicApiTools';
import { enforceRateLimit } from '../../rateLimitHeaders';
import { readToolArgs } from '../../readToolArgs';

export const dynamic = 'force-dynamic';

/**
 * `POST /api/v1/tools/{name}` — body는 도구 인자(JSON), 응답은 실행기 결과.
 *
 * 순서: 인증 → 도구 존재 → 본문 → 스키마 검증 → 한도 소비 → 실행. 값싼 거절을 한도 소비
 * 앞에 두어, 잘못된 요청이 키의 분당 한도를 깎지 않게 한다. 여기서 소비하는 것은 회원 단위 `data`
 * 버킷이다. `run_fresh_analysis`가 캐시 미스로 LLM을 부를 때만 실행 안에서 `ai` 버킷을 추가로
 * 소비한다(캐시 적중은 `data`만 쓴다).
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ name: string }> }
): Promise<Response> {
    return withApiErrorBoundary('tools/[name]', async () => {
        const auth = await requireApiKey(request);
        if (!auth.ok) return auth.response;

        const { name } = await params;
        const spec = findPublicApiToolSpec(name);
        if (spec === undefined)
            return apiError(
                API_STATUS.notFound,
                'unknown_tool',
                'No such tool. See GET /api/v1/tools for the available tools.'
            );

        const body = await readToolArgs(request);
        if (!body.ok) return body.response;

        const validated = validateArgs(spec.inputSchema, body.args);
        if (!validated.ok)
            return apiError(
                API_STATUS.badRequest,
                'invalid_args',
                'The tool arguments do not match the tool schema.',
                { details: { issues: validated.issues } }
            );

        const limit = await enforceRateLimit(auth.principal.userId, 'data');
        if (!limit.ok) return limit.response;

        const outcome = await executePublicTool(
            spec,
            validated.value,
            auth.principal,
            resolveApiLocale(request),
            request.signal
        );
        if (isPublicToolStream(outcome)) {
            // 긴 생성(`run_fresh_analysis`): 사전 검사를 모두 통과했다. 200으로 시작해 공백 heartbeat를
            // 흘리고 최종 JSON을 쓴다 — 실패도 200 본문의 `{ error }`다(상태는 이미 나갔다).
            return streamingJsonResponse({
                // data 버킷 한도 + 소비한 ai 버킷 상태(`X-RateLimit-AI-*`).
                headers: { ...limit.headers, ...outcome.headers },
                signal: request.signal,
                body: outcome.completion.then(final =>
                    final.ok
                        ? okBody(final.data, {
                              tool: spec.name,
                              ...(final.truncated
                                  ? { truncated: true as const }
                                  : {}),
                              ...final.meta,
                          })
                        : errorBody(final.code, final.message, final.details)
                ),
                onBodyError: () =>
                    errorBody('internal_error', 'Unexpected server error.'),
            });
        }
        if (!outcome.ok)
            return apiError(outcome.status, outcome.code, outcome.message, {
                // 오류 응답 자체의 헤더(`ai` 버킷 429의 한도 헤더·`Retry-After`)가 `data` 버킷 헤더를 덮는다.
                headers: { ...limit.headers, ...outcome.headers },
                details: outcome.details,
            });
        return apiOk(
            outcome.data,
            {
                tool: spec.name,
                ...(outcome.truncated ? { truncated: true as const } : {}),
                ...outcome.meta,
            },
            limit.headers
        );
    });
}
