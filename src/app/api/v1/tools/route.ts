import { apiOk, withApiErrorBoundary } from '../apiResponse';
import { requireApiKey } from '../authenticate';
import { enforceRateLimit } from '../rateLimitHeaders';
import { publicApiToolSpecs } from '../publicApiTools';

export const dynamic = 'force-dynamic';

/**
 * `GET /api/v1/tools` — 사용할 수 있는 도구와 JSON schema. 스펙은 core의
 * `AGENT_TOOL_SPECS` 그대로이고, 에이전트의 쿼터 구분용 `costClass`만 뺀다(외부 소비자에게
 * 의미가 없는 내부 분류다). `data` 버킷의 한도를 1회 소비한다(키 조회 폭주로 인증 저장소를 두드리는 것을 막는다).
 */
export async function GET(request: Request): Promise<Response> {
    return withApiErrorBoundary('tools', async () => {
        const auth = await requireApiKey(request);
        if (!auth.ok) return auth.response;
        const limit = await enforceRateLimit(auth.principal.userId, 'data');
        if (!limit.ok) return limit.response;
        const tools = publicApiToolSpecs().map(
            ({ name, description, inputSchema }) => ({
                name,
                description,
                inputSchema,
            })
        );
        return apiOk({ tools }, {}, limit.headers);
    });
}
