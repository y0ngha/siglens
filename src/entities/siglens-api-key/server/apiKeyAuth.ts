import 'server-only';
import { DrizzleSiglensApiKeyRepository } from '@/entities/siglens-api-key/api';
import {
    hashApiKey,
    parseBearerApiKey,
} from '@/entities/siglens-api-key/lib/apiKeyToken';
import type {
    ApiKeyAuthResult,
    ApiKeyPrincipal,
} from '@/entities/siglens-api-key/model';
import { getRedisClient } from '@/shared/cache/redisClient';
import {
    API_KEY_AUTH_CACHE_TTL_SECONDS,
    API_KEY_REVOKED_TOMBSTONE_TTL_SECONDS,
} from '@/shared/config/publicApi';
import { MS_PER_MINUTE } from '@/shared/config/time';
import { USER_TIER_VALUES } from '@/shared/db/constants';
import { getDatabaseClient } from '@/shared/db/client';

const CACHE_KEY_PREFIX = 'siglens-api:key:';
const TOMBSTONE_KEY_PREFIX = 'siglens-api:revoked:';
const TIERS: ReadonlySet<string> = new Set(USER_TIER_VALUES);

/** 같은 경고를 인스턴스당 이 간격에 한 번만 남긴다(Redis 장애 중 로그 폭주 방지, SERVER.md#SA-4). */
const WARN_INTERVAL_MS = MS_PER_MINUTE;
let lastCacheWarnAt = 0;

function warnCacheUnavailable(op: string, error: unknown): void {
    const now = Date.now();
    if (now - lastCacheWarnAt < WARN_INTERVAL_MS) return;
    lastCacheWarnAt = now;
    console.warn('[siglensApiKeyAuth] cache unavailable:', op, error);
}

/** Test-only: makes the once-per-minute warn throttle deterministic. */
export function resetApiKeyAuthWarnForTests(): void {
    lastCacheWarnAt = 0;
}

const cacheKey = (keyHash: string): string => `${CACHE_KEY_PREFIX}${keyHash}`;
const tombstoneKey = (keyHash: string): string =>
    `${TOMBSTONE_KEY_PREFIX}${keyHash}`;

function isPrincipal(value: unknown): value is ApiKeyPrincipal {
    if (typeof value !== 'object' || value === null) return false;
    const v = value as Record<string, unknown>;
    return (
        typeof v.keyId === 'string' &&
        typeof v.keyName === 'string' &&
        typeof v.keyPrefix === 'string' &&
        typeof v.userId === 'string' &&
        typeof v.tier === 'string' &&
        TIERS.has(v.tier)
    );
}

interface AuthCacheState {
    principal: ApiKeyPrincipal | null;
    /** 폐기 묘비가 있다 — 캐시 값이 있어도 믿지 않는다. */
    tombstoned: boolean;
    /** Redis를 읽을 수 있었다. false면 캐시·묘비를 모르는 상태라 캐시를 쓰지 않는다. */
    available: boolean;
}

const UNAVAILABLE_CACHE: AuthCacheState = {
    principal: null,
    tombstoned: false,
    available: false,
};

/**
 * 캐시 값과 폐기 묘비를 MGET 한 번으로 읽는다. Upstash가 JSON 문자열 값을 읽을 때 자동으로
 * 파싱하므로 객체/문자열 둘 다 받는다. 캐시는 최적화일 뿐이라 읽기 실패·모양 불일치는 miss로
 * 보고 DB로 간다.
 */
async function readAuthCacheState(keyHash: string): Promise<AuthCacheState> {
    const redis = getRedisClient();
    if (redis === null) return UNAVAILABLE_CACHE;
    try {
        const [raw, tombstone] = await redis.mget<[unknown, unknown]>(
            cacheKey(keyHash),
            tombstoneKey(keyHash)
        );
        const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return {
            principal: isPrincipal(value) ? value : null,
            tombstoned: tombstone !== null && tombstone !== undefined,
            available: true,
        };
    } catch (error) {
        warnCacheUnavailable('mget', error);
        return UNAVAILABLE_CACHE;
    }
}

/**
 * 묘비 재확인. 조회가 실패하면 `'unknown'` — 호출부는 그때 캐시를 쓰지 않는다. 모르는 상태에서
 * 캐시를 쓰면 방금 폐기된 주체가 TTL 동안 되살아날 수 있다(MGET 실패 시 캐시를 건너뛰는 것과 같은 규칙).
 */
async function tombstoneState(
    keyHash: string
): Promise<'tombstoned' | 'clear' | 'unknown'> {
    const redis = getRedisClient();
    if (redis === null) return 'unknown';
    try {
        return (await redis.exists(tombstoneKey(keyHash))) > 0
            ? 'tombstoned'
            : 'clear';
    } catch (error) {
        warnCacheUnavailable('exists', error);
        return 'unknown';
    }
}

async function writeCachedPrincipal(
    keyHash: string,
    principal: ApiKeyPrincipal
): Promise<void> {
    const redis = getRedisClient();
    if (redis === null) return;
    try {
        await redis.set(cacheKey(keyHash), principal, {
            ex: API_KEY_AUTH_CACHE_TTL_SECONDS,
        });
    } catch (error) {
        warnCacheUnavailable('set', error);
    }
}

/**
 * 폐기한 키(들)의 인증을 즉시 끊는다: 먼저 묘비를 쓰고(`API_KEY_REVOKED_TOMBSTONE_TTL_SECONDS`)
 * 그다음 캐시 항목을 지운다. 순서가 중요하다 — 지운 뒤 묘비를 쓰면 그 사이에 진행 중 요청이
 * 폐기된 주체를 다시 캐시할 수 있다. 묘비가 있는 동안 인증은 캐시 적중도 거절하고 캐시를 쓰지
 * 않는다. 계정 삭제도 같은 경로를 쓴다.
 *
 * 성공 여부를 돌려준다 — 실패하면 호출부는 최대 캐시 TTL까지 폐기가 늦게 반영될 수 있다는
 * 것을 알고 로그를 남긴다(DB는 이미 폐기됐다).
 */
export async function revokeApiKeyAuth(
    keyHashes: readonly string[]
): Promise<boolean> {
    if (keyHashes.length === 0) return true;
    const redis = getRedisClient();
    if (redis === null) return true;
    try {
        await Promise.all(
            keyHashes.map(hash =>
                redis.set(tombstoneKey(hash), 1, {
                    ex: API_KEY_REVOKED_TOMBSTONE_TTL_SECONDS,
                })
            )
        );
        await redis.del(...keyHashes.map(cacheKey));
        return true;
    } catch (error) {
        console.error(
            '[siglensApiKeyAuth] revocation propagation failed; auth may lag by up to the cache TTL:',
            error
        );
        return false;
    }
}

/**
 * `Authorization: Bearer slk_...`을 인증한다. 세션 쿠키는 보지 않는다(쿠키 인증과 섞지 않는다).
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
            console.error('[siglensApiKeyAuth] touchLastUsed failed:', error);
        }
        return { status: 'ok', principal };
    } catch (error) {
        console.error('[siglensApiKeyAuth] key lookup failed:', error);
        return { status: 'unavailable' };
    }
}
