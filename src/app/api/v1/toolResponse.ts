import { apiError, apiOk, errorBody, okBody } from './apiResponse';
import { streamingJsonResponse } from './apiStream';
import { isPublicToolStream, type PublicToolResult } from './publicToolOutcome';

/**
 * 도구 실행 결과를 HTTP 응답으로 바꾼다(`POST /api/v1/tools/{name}` 전용). 응답 모양은 결과 종류가 정한다:
 * 긴 생성은 200 스트림, 실패는 `{ error }` 봉투, 성공은 `{ data, meta }` 봉투.
 *
 * 한도 헤더는 `data` 버킷 값(`limitHeaders`)이 기본이고, 실행 결과가 싣는 헤더(`ai` 버킷의 `X-RateLimit-AI-*`·
 * 429의 `Retry-After`)가 그 위에 얹힌다 — 같은 이름이면 결과 쪽이 이긴다.
 */
export function toolOutcomeResponse(
    outcome: PublicToolResult,
    toolName: string,
    limitHeaders: Record<string, string>,
    signal: AbortSignal
): Response {
    if (isPublicToolStream(outcome)) {
        // 긴 생성(`run_fresh_analysis`): 사전 검사를 모두 통과했다. 200으로 시작해 공백 heartbeat를
        // 흘리고 최종 JSON을 쓴다 — 실패도 200 본문의 `{ error }`다(상태는 이미 나갔다).
        return streamingJsonResponse({
            headers: { ...limitHeaders, ...outcome.headers },
            signal,
            body: outcome.completion.then(final =>
                final.ok
                    ? okBody(final.data, {
                          tool: toolName,
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
            headers: { ...limitHeaders, ...outcome.headers },
            details: outcome.details,
        });
    return apiOk(
        outcome.data,
        {
            tool: toolName,
            ...(outcome.truncated ? { truncated: true as const } : {}),
            ...outcome.meta,
        },
        limitHeaders
    );
}
