import { tryGetDatabaseClient } from '@/shared/db/client';
import type { AssetTranslationRepository } from '@/shared/db/types';
import type { AssetInfo } from '@/shared/lib/types';
import type { CacheProvider } from '@y0ngha/siglens-core';
import { DrizzleAssetTranslationRepository } from '../api';
import {
    ASSET_INFO_CACHE_TTL_WITHOUT_KOREAN,
    buildAssetInfoProvisionalCacheKey,
} from '../lib/cacheKeys';
import { recordToAssetInfo } from '../lib/assetInfoResolution';

function tryGetRepository(): AssetTranslationRepository | null {
    const client = tryGetDatabaseClient();
    if (!client) return null;
    return new DrizzleAssetTranslationRepository(client.db);
}

/**
 * 캐시 쓰기는 응답을 막지 않는다 — 실패는 경고만 남기고 삼킨다. `getAssetInfo`가
 * 임시 항목·API 전용 항목을 쓰는 모든 지점이 공유한다.
 */
export function setCacheBestEffort(
    cache: CacheProvider | null,
    cacheKey: string,
    info: AssetInfo,
    ttlSeconds: number
): void {
    if (!cache) return;
    cache
        .set(cacheKey, info, ttlSeconds)
        .catch(e => console.warn('[getAssetInfo] cache write failed', e));
}

/**
 * Next.js가 네비게이션마다 진행 중 요청을 취소할 때 나는 AbortError는 예상된
 * 동작이라 로그를 남기지 않는다. DB 드라이버(postgres-js)는 TCP라 fetch의
 * AbortSignal을 거치지 않으므로 `cause.sourceError`로 한 겹 감싸 던지던 옛 Neon HTTP
 * 형태는 더 이상 없다 — 직접 던져진 AbortError만 본다.
 */
function isAbortError(e: unknown): boolean {
    return e instanceof Error && e.name === 'AbortError';
}

/**
 * `asset_translations`에서 한 심볼을 읽는다. DB 클라이언트가 없거나 읽기가 실패하면
 * (AbortError 포함) `null`이라 호출부가 다음 해석 단계로 내려간다.
 */
export async function readFromDatabase(
    symbol: string
): Promise<AssetInfo | null> {
    const repository = tryGetRepository();
    if (!repository) return null;

    try {
        const record = await repository.findBySymbol(symbol);
        return record ? recordToAssetInfo(record) : null;
    } catch (e) {
        if (isAbortError(e)) return null;
        console.warn('[getAssetInfo] DB read failed', e);
        return null;
    }
}

/**
 * 번역 결과를 `asset_translations`에 upsert하고, DB에 실제로 썼는지 돌려준다.
 *
 * Redis에는 쓰지 않는다 — 읽기 경로가 DB를 먼저 보므로(`resolveAssetInfo` JSDoc)
 * 1년짜리 Redis 사본은 DB와 중복이고 명령 수만 늘린다. DB에 못 쓴 경우의 보완은
 * 호출부(`persistOrCacheProvisional`)가 `false`를 보고 처리한다.
 *
 * @returns DB 클라이언트가 없거나 upsert가 실패하면 `false`.
 */
async function persistTranslation(
    info: Pick<AssetInfo, 'symbol' | 'name'> & { koreanName: string },
    fmpSymbol: string
): Promise<boolean> {
    const { symbol, name, koreanName } = info;
    const repository = tryGetRepository();
    if (!repository) return false;

    try {
        await repository.upsert({ symbol, name, koreanName, fmpSymbol });
        return true;
    } catch (e) {
        console.warn('[getAssetInfo] DB upsert failed', e);
        return false;
    }
}

/**
 * 번역을 DB에 저장하되, DB에 쓰지 못했으면 한글명을 담은 12시간 임시 항목을 Redis에 쓴다.
 *
 * DB가 저하된 동안(클라이언트 없음·upsert 실패·repository 생성 실패)에는 한글명이
 * 어디에도 남지 않아, `unstable_cache`로 감싸이지 않은 호출자(`getAssetLabelsAction`,
 * `savePortfolioHoldingAction` 등)가 호출마다 FMP/yahoo 조회와 번역을 반복한다.
 * 임시 항목이 그 반복을 막는다. DB 저장이 성공하면 읽기 경로가 DB에서 바로 잡으므로
 * Redis에는 쓰지 않는다.
 *
 * repository 생성이 던져도(`persistTranslation` reject) 임시 항목은 쓰고 그 거절은
 * 그대로 전파한다 — 호출부의 `.catch`가 warn으로 삼킨다.
 */
export async function persistOrCacheProvisional(
    info: AssetInfo & { koreanName: string },
    fmpSymbol: string,
    cache: CacheProvider | null
): Promise<void> {
    const outcome = await persistTranslation(info, fmpSymbol).then(
        persisted => ({ persisted, rejected: false as const }),
        (error: unknown) => ({
            persisted: false,
            rejected: true as const,
            error,
        })
    );
    if (!outcome.persisted) {
        setCacheBestEffort(
            cache,
            buildAssetInfoProvisionalCacheKey(info.symbol),
            info,
            ASSET_INFO_CACHE_TTL_WITHOUT_KOREAN
        );
    }
    if (outcome.rejected) throw outcome.error;
}
