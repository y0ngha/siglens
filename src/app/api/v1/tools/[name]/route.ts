import { validateArgs } from '@y0ngha/siglens-core';
import { apiError, API_STATUS, withApiErrorBoundary } from '../../apiResponse';
import { requireApiKey } from '../../authenticate';
import { executePublicTool, resolveApiLocale } from '../../executePublicTool';
import { findPublicApiToolSpec } from '../../publicApiTools';
import { enforceRateLimit } from '../../rateLimitHeaders';
import { readToolArgs } from '../../readToolArgs';
import { toolOutcomeResponse } from '../../toolResponse';

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
        return toolOutcomeResponse(
            outcome,
            spec.name,
            limit.headers,
            request.signal
        );
    });
}
