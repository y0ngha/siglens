import { DrizzleUserApiKeyRepository } from '@/entities/api-key/api';
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
 * `defaultModel`은 `users.api_default_model`이 들어오는 PR-B 전까지 항상 `null`이다.
 */
export async function GET(request: Request): Promise<Response> {
    return withApiErrorBoundary('me', async () => {
        const auth = await requireApiKey(request);
        if (!auth.ok) return auth.response;
        const { principal } = auth;
        const limit = await enforceRateLimit(principal.userId, 'data');
        if (!limit.ok) return limit.response;

        let providers: string[];
        try {
            const rows = await new DrizzleUserApiKeyRepository(
                getDatabaseClient().db
            ).findByUser(principal.userId);
            providers = rows.map(row => row.provider).toSorted();
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
                defaultModel: null,
                byokProviders: providers,
                rateLimits: await peekRateLimits(principal.userId),
            },
            {},
            limit.headers
        );
    });
}
