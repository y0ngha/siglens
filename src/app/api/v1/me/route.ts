import { DrizzleUserApiKeyRepository } from '@/entities/api-key/api';
import { DrizzleSiglensApiKeyRepository } from '@/entities/siglens-api-key/api';
import { peekRateLimits } from '@/entities/siglens-api-key/server/rateLimit';
import { getDatabaseClient } from '@/shared/db/client';
import {
    apiError,
    apiOk,
    API_STATUS,
    withApiErrorBoundary,
} from '../apiResponse';
import { requireApiKey } from '../authenticate';
import { enforceRateLimit } from '../rateLimitHeaders';

export const dynamic = 'force-dynamic';

/**
 * `GET /api/v1/me` — 키 이름·접두, 회원 tier, 등록된 BYOK provider, 남은 한도.
 * `data` 버킷의 한도를 1회 소비한다(그 직후의 남은 한도를 보여 준다). 한도 저장소를 못 읽으면 `rateLimits`만 `null`로
 * 비우고 나머지는 돌려준다.
 *
 * `defaultModel`은 계정 화면에서 고른 API 기본 모델(`users.api_default_model`)이고, 없으면 `null`이다
 * (`run_fresh_analysis`는 그때 요청의 `model`을 요구한다). 등록 키가 지워졌어도 저장된 값은 그대로 보인다.
 */
export async function GET(request: Request): Promise<Response> {
    return withApiErrorBoundary('me', async () => {
        const auth = await requireApiKey(request);
        if (!auth.ok) return auth.response;
        const { principal } = auth;
        const limit = await enforceRateLimit(principal.userId, 'data');
        if (!limit.ok) return limit.response;

        let providers: string[];
        let defaultModel: string | null;
        try {
            const { db } = getDatabaseClient();
            const [rows, storedModel] = await Promise.all([
                new DrizzleUserApiKeyRepository(db).findByUser(
                    principal.userId
                ),
                new DrizzleSiglensApiKeyRepository(db).findApiDefaultModel(
                    principal.userId
                ),
            ]);
            providers = rows.map(row => row.provider).toSorted();
            defaultModel = storedModel;
        } catch (error) {
            console.error('[api/v1/me] provider lookup failed:', error);
            return apiError(
                API_STATUS.serviceUnavailable,
                'service_unavailable',
                'Account data is temporarily unavailable. Retry shortly.',
                { headers: limit.headers }
            );
        }

        return apiOk(
            {
                key: {
                    id: principal.keyId,
                    name: principal.keyName,
                    prefix: principal.keyPrefix,
                },
                tier: principal.tier,
                defaultModel,
                byokProviders: providers,
                rateLimits: await peekRateLimits(principal.userId),
            },
            {},
            limit.headers
        );
    });
}
