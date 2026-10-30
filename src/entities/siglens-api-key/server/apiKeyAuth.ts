import 'server-only';
import { DrizzleSiglensApiKeyRepository } from '@/entities/siglens-api-key/api';
import { parseBearerApiKey } from '@/entities/siglens-api-key/lib/apiKeyToken';
import type { ApiKeyAuthResult } from '@/entities/siglens-api-key/model';
import {
    readAuthCacheState,
    tombstoneState,
    writeCachedPrincipal,
} from '@/entities/siglens-api-key/server/apiKeyAuthCache';
import { hashApiKey } from '@/entities/siglens-api-key/server/apiKeyToken';
import { getDatabaseClient } from '@/shared/db/client';
import { logActionError } from '@/shared/lib/logActionError';

/**
 * `Authorization: Bearer slk_...`을 인증한다. 세션 쿠키는 보지 않는다(쿠키 인증과 섞지 않는다).
 * `src/app/api/v1`의 모든 보호 경로가 첫 단계로 부른다.
 *
 * - 형식 불일치·없는 키·폐기 키·이메일 미인증 회원은 전부 `invalid`(호출부가 같은 401을 낸다).
 * - 키 저장소(DB)를 읽지 못하면 `unavailable`. 거짓 401로 클라이언트가 키를 지우게 만들지 않는다.
 * - 조회 결과를 `API_KEY_AUTH_CACHE_TTL_SECONDS` 동안 캐시한다. 그만큼 tier·미인증 전환이 늦게
 *   반영될 수 있다(폐기·계정 삭제는 `revokeApiKeyAuth`로 즉시).
 */
export async function authenticateApiKey(
    authorizationHeader: string | null
): Promise<ApiKeyAuthResult> {
    const rawKey = parseBearerApiKey(authorizationHeader);
    if (rawKey === null) return { status: 'invalid' };
    const keyHash = hashApiKey(rawKey);

    const cache = await readAuthCacheState(keyHash);
    if (cache.tombstoned) return { status: 'invalid' };
    if (cache.principal !== null)
        return { status: 'ok', principal: cache.principal };

    try {
        const repo = new DrizzleSiglensApiKeyRepository(getDatabaseClient().db);
        const principal = await repo.findActivePrincipalByHash(keyHash);
        if (principal === null) return { status: 'invalid' };
        if (cache.available) {
            // 이 DB 읽기와 폐기가 겹쳤을 수 있다 — 묘비가 생겼다면 캐시를 쓰지 않고 거절한다.
            const tombstone = await tombstoneState(keyHash);
            if (tombstone === 'tombstoned') return { status: 'invalid' };
            // 상태를 모르면 인증은 DB 결과로 통과시키되 캐시는 쓰지 않는다.
            if (tombstone === 'clear')
                await writeCachedPrincipal(keyHash, principal);
        }
        try {
            await repo.touchLastUsed(principal.keyId);
        } catch (error) {
            // 사용 시각은 부가 정보다 — 실패가 인증을 막지 않는다.
            logActionError('[siglensApiKeyAuth] touchLastUsed failed:', error);
        }
        return { status: 'ok', principal };
    } catch (error) {
        console.error('[siglensApiKeyAuth] key lookup failed:', error);
        return { status: 'unavailable' };
    }
}
