const { mockGetRedis, mockFind, mockTouch } = vi.hoisted(() => ({
    mockGetRedis: vi.fn(),
    mockFind: vi.fn(),
    mockTouch: vi.fn(),
}));
vi.mock('@/shared/cache/redisClient', () => ({ getRedisClient: mockGetRedis }));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {} })),
}));
vi.mock('@/entities/siglens-api-key/api', () => ({
    DrizzleSiglensApiKeyRepository: vi.fn().mockImplementation(function () {
        return {
            findActivePrincipalByHash: mockFind,
            touchLastUsed: mockTouch,
        };
    }),
}));

import { authenticateApiKey } from '@/entities/siglens-api-key/server/apiKeyAuth';
import {
    resetApiKeyAuthWarnForTests,
    revokeApiKeyAuth,
} from '@/entities/siglens-api-key/server/apiKeyAuthCache';
import type { ApiKeyPrincipal } from '@/entities/siglens-api-key/model';
import { hashApiKey } from '@/entities/siglens-api-key/server/apiKeyToken';
import { API_KEY_AUTH_CACHE_TTL_SECONDS } from '@/shared/config/publicApi';

const RAW_KEY = `slk_${'k7Q'.repeat(13)}x`;
const HEADER = `Bearer ${RAW_KEY}`;
const KEY_HASH = hashApiKey(RAW_KEY);

const principal: ApiKeyPrincipal = {
    keyId: '33333333-3333-4333-8333-333333333333',
    keyName: '내 에이전트',
    keyPrefix: 'slk_k7Qk7Q',
    userId: '11111111-1111-4111-8111-111111111111',
    tier: 'member',
};

function makeRedis(overrides: Record<string, unknown> = {}) {
    return {
        mget: vi.fn().mockResolvedValue([null, null]),
        exists: vi.fn().mockResolvedValue(0),
        set: vi.fn().mockResolvedValue('OK'),
        del: vi.fn().mockResolvedValue(1),
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    resetApiKeyAuthWarnForTests();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockTouch.mockResolvedValue(undefined);
});

describe('authenticateApiKey — 형식 거절', () => {
    it.each([
        ['헤더 없음', null],
        ['형식이 아닌 토큰', 'Bearer nope'],
        ['다른 스킴', `Token ${RAW_KEY}`],
    ])('%s이면 DB·Redis를 보지 않고 invalid', async (_label, header) => {
        mockGetRedis.mockReturnValue(makeRedis());
        await expect(authenticateApiKey(header)).resolves.toEqual({
            status: 'invalid',
        });
        expect(mockFind).not.toHaveBeenCalled();
        expect(mockGetRedis).not.toHaveBeenCalled();
    });
});

describe('authenticateApiKey — 캐시 적중', () => {
    it('캐시된 principal로 인증하고 DB를 부르지 않는다', async () => {
        const redis = makeRedis({
            mget: vi.fn().mockResolvedValue([principal, null]),
        });
        mockGetRedis.mockReturnValue(redis);
        await expect(authenticateApiKey(HEADER)).resolves.toEqual({
            status: 'ok',
            principal,
        });
        expect(redis.mget).toHaveBeenCalledWith(
            `siglens-api:key:${KEY_HASH}`,
            `siglens-api:revoked:${KEY_HASH}`
        );
        expect(mockFind).not.toHaveBeenCalled();
    });

    it('JSON 문자열로 돌아온 값도 받는다', async () => {
        mockGetRedis.mockReturnValue(
            makeRedis({
                mget: vi
                    .fn()
                    .mockResolvedValue([JSON.stringify(principal), null]),
            })
        );
        await expect(authenticateApiKey(HEADER)).resolves.toEqual({
            status: 'ok',
            principal,
        });
    });

    it('모양이 어긋난 캐시 값은 miss로 보고 DB로 간다', async () => {
        mockGetRedis.mockReturnValue(
            makeRedis({
                mget: vi
                    .fn()
                    .mockResolvedValue([{ ...principal, tier: 'root' }, null]),
            })
        );
        mockFind.mockResolvedValue(principal);
        await expect(authenticateApiKey(HEADER)).resolves.toEqual({
            status: 'ok',
            principal,
        });
        expect(mockFind).toHaveBeenCalledWith(KEY_HASH);
    });
});

describe('authenticateApiKey — 캐시 miss', () => {
    it('원문이 아니라 sha256 해시로 조회한다', async () => {
        mockGetRedis.mockReturnValue(makeRedis());
        mockFind.mockResolvedValue(principal);
        await authenticateApiKey(HEADER);
        expect(mockFind).toHaveBeenCalledTimes(1);
        expect(mockFind.mock.calls.flat()).not.toContain(RAW_KEY);
        expect(mockFind).toHaveBeenCalledWith(KEY_HASH);
    });

    it('찾으면 TTL을 붙여 캐시하고 사용 시각을 갱신한다', async () => {
        const redis = makeRedis();
        mockGetRedis.mockReturnValue(redis);
        mockFind.mockResolvedValue(principal);
        await authenticateApiKey(HEADER);
        expect(redis.set).toHaveBeenCalledWith(
            `siglens-api:key:${KEY_HASH}`,
            principal,
            { ex: API_KEY_AUTH_CACHE_TTL_SECONDS }
        );
        expect(mockTouch).toHaveBeenCalledWith(principal.keyId);
    });

    it('폐기·미인증·없는 키(DB null)는 invalid이고 캐시하지 않는다', async () => {
        const redis = makeRedis();
        mockGetRedis.mockReturnValue(redis);
        mockFind.mockResolvedValue(null);
        await expect(authenticateApiKey(HEADER)).resolves.toEqual({
            status: 'invalid',
        });
        expect(redis.set).not.toHaveBeenCalled();
        expect(mockTouch).not.toHaveBeenCalled();
    });

    it('DB 조회가 던지면 invalid가 아니라 unavailable', async () => {
        mockGetRedis.mockReturnValue(makeRedis());
        mockFind.mockRejectedValue(new Error('connection refused'));
        await expect(authenticateApiKey(HEADER)).resolves.toEqual({
            status: 'unavailable',
        });
    });

    it('Redis가 없으면(null) 캐시 없이 DB로 인증한다', async () => {
        mockGetRedis.mockReturnValue(null);
        mockFind.mockResolvedValue(principal);
        await expect(authenticateApiKey(HEADER)).resolves.toEqual({
            status: 'ok',
            principal,
        });
    });

    it('Redis 읽기가 던져도 DB로 인증한다', async () => {
        mockGetRedis.mockReturnValue(
            makeRedis({ mget: vi.fn().mockRejectedValue(new Error('timeout')) })
        );
        mockFind.mockResolvedValue(principal);
        await expect(authenticateApiKey(HEADER)).resolves.toEqual({
            status: 'ok',
            principal,
        });
    });

    it('Redis 쓰기가 던져도 인증은 성공한다', async () => {
        mockGetRedis.mockReturnValue(
            makeRedis({ set: vi.fn().mockRejectedValue(new Error('timeout')) })
        );
        mockFind.mockResolvedValue(principal);
        await expect(authenticateApiKey(HEADER)).resolves.toEqual({
            status: 'ok',
            principal,
        });
    });

    it('사용 시각 갱신이 실패해도 인증은 성공한다', async () => {
        mockGetRedis.mockReturnValue(makeRedis());
        mockFind.mockResolvedValue(principal);
        mockTouch.mockRejectedValue(new Error('read-only'));
        await expect(authenticateApiKey(HEADER)).resolves.toEqual({
            status: 'ok',
            principal,
        });
        expect(console.error).toHaveBeenCalledWith(
            '[siglensApiKeyAuth] touchLastUsed failed:',
            { name: 'Error', code: undefined }
        );
    });

    it('캐시 경고는 인스턴스당 분당 한 번만 남긴다', async () => {
        mockGetRedis.mockReturnValue(
            makeRedis({ mget: vi.fn().mockRejectedValue(new Error('timeout')) })
        );
        mockFind.mockResolvedValue(principal);
        await authenticateApiKey(HEADER);
        await authenticateApiKey(HEADER);
        expect(console.warn).toHaveBeenCalledTimes(1);
    });
});

describe('폐기 묘비 — 캐시 적중에서도 거절', () => {
    it('캐시에 principal이 있어도 묘비가 있으면 invalid이고 DB도 보지 않는다', async () => {
        mockGetRedis.mockReturnValue(
            makeRedis({ mget: vi.fn().mockResolvedValue([principal, 1]) })
        );
        await expect(authenticateApiKey(HEADER)).resolves.toEqual({
            status: 'invalid',
        });
        expect(mockFind).not.toHaveBeenCalled();
    });

    it('캐시가 비어 있고 묘비만 있어도 invalid(DB가 아직 유효로 답하는 진행 중 요청 포함)', async () => {
        mockGetRedis.mockReturnValue(
            makeRedis({ mget: vi.fn().mockResolvedValue([null, 1]) })
        );
        mockFind.mockResolvedValue(principal);
        await expect(authenticateApiKey(HEADER)).resolves.toEqual({
            status: 'invalid',
        });
        expect(mockFind).not.toHaveBeenCalled();
    });

    it('경합 순서: DB 읽기 뒤 캐시 쓰기 전에 폐기되면 캐시를 쓰지 않고 invalid', async () => {
        // 1) mget: 캐시·묘비 없음  2) DB: 아직 유효  3) 그 사이 폐기 -> 묘비 생김  4) 쓰기 직전 재확인
        const redis = makeRedis({ exists: vi.fn().mockResolvedValue(1) });
        mockGetRedis.mockReturnValue(redis);
        mockFind.mockResolvedValue(principal);
        await expect(authenticateApiKey(HEADER)).resolves.toEqual({
            status: 'invalid',
        });
        expect(redis.exists).toHaveBeenCalledWith(
            `siglens-api:revoked:${KEY_HASH}`
        );
        expect(redis.set).not.toHaveBeenCalled();
        expect(mockTouch).not.toHaveBeenCalled();
    });

    it('묘비 재확인이 실패하면(상태 모름) DB 결과로 인증하되 캐시는 쓰지 않는다', async () => {
        const redis = makeRedis({
            exists: vi.fn().mockRejectedValue(new Error('timeout')),
        });
        mockGetRedis.mockReturnValue(redis);
        mockFind.mockResolvedValue(principal);
        const result = await authenticateApiKey(HEADER);
        expect(result).toEqual({ status: 'ok', principal });
        expect(redis.set).not.toHaveBeenCalled();
    });

    it('묘비가 없으면 평소처럼 캐시를 쓴다(재확인이 항상 거절하지 않는다)', async () => {
        const redis = makeRedis();
        mockGetRedis.mockReturnValue(redis);
        mockFind.mockResolvedValue(principal);
        await authenticateApiKey(HEADER);
        expect(redis.exists).toHaveBeenCalledTimes(1);
        expect(redis.set).toHaveBeenCalledTimes(1);
    });

    it('폐기 직후 재캐시된 값이 있어도 다음 요청은 묘비로 막힌다', async () => {
        // 상태 있는 fake: 폐기 -> (늦은 요청이 캐시를 다시 씀) -> 인증
        const store = new Map<string, unknown>();
        const redis = {
            mget: vi.fn(async (...keys: string[]) =>
                keys.map(key => store.get(key) ?? null)
            ),
            exists: vi.fn(async () => 0),
            set: vi.fn(async (key: string, value: unknown) => {
                store.set(key, value);
                return 'OK';
            }),
            del: vi.fn(async (...keys: string[]) => {
                keys.forEach(key => store.delete(key));
                return keys.length;
            }),
        };
        mockGetRedis.mockReturnValue(redis);
        await revokeApiKeyAuth([KEY_HASH]);
        // 늦은 진행 중 요청이 폐기된 주체를 다시 캐시한 상황을 직접 만든다.
        store.set(`siglens-api:key:${KEY_HASH}`, principal);
        await expect(authenticateApiKey(HEADER)).resolves.toEqual({
            status: 'invalid',
        });
    });
});
