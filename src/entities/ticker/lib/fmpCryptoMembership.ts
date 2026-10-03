import 'server-only';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { MS_PER_HOUR, SECONDS_PER_DAY } from '@/shared/config/time';
import { fetchCryptoAssetList } from '../api';
import { CRYPTO_FMP_LIST_CACHE_KEY } from './cacheKeys';
import type { CryptoAssetRow } from './fmpCryptoListClient';

/** Shape of a single entry in the FMP cryptocurrency list. */
export interface FmpCryptoEntry {
    name: string;
}

/** Serializable form stored in Redis (Map is not JSON-serializable). */
type FmpCryptoListRecord = Record<string, FmpCryptoEntry>;

/**
 * 인스턴스 메모리(L1)에 목록을 들고 있는 시간. Redis(L2) TTL 24h보다 짧게 둬서
 * 인스턴스마다 많아야 1시간 늦게 새 코인을 본다 — `crypto_assets` 재시드 주기(일 단위)에
 * 비하면 무시할 지연이다.
 */
export const FMP_CRYPTO_LIST_MEMORY_TTL_MS = MS_PER_HOUR;

let memo: { map: Map<string, FmpCryptoEntry>; expiresAt: number } | null = null;
let inFlight: Promise<Map<string, FmpCryptoEntry>> | null = null;

/**
 * Fetch the full FMP cryptocurrency-list as an upper-symbol-keyed Map.
 *
 * 두 단계로 캐시한다.
 * - L1 인스턴스 메모리(1h): `isCryptoSymbol`은 `crypto_assets`에 없는 심볼 —
 *   사실상 모든 주식 — 을 처음 볼 때마다 이 목록으로 멤버십을 확인한다. L1이 없던
 *   시절엔 그때마다 Redis에서 ~170KB 값을 통째로 받았다: 2026-10 운영 Redis MONITOR
 *   2분 표본에서 앱 명령의 7%가 이 키 GET(약 7초에 한 번)이었고, 월 ~65GB로
 *   Upstash 대역폭의 ~30%였다(재측정: 운영 Upstash에 TLS `redis-cli MONITOR`로 2분
 *   표본을 떠 앱 EIP 트래픽만 집계 — PR #914 설명). 운영은 장수 EC2 프로세스라 모듈
 *   메모리가 유지된다.
 * - L2 Redis(24h, `getOrSetCache`): 인스턴스 간 공유와 콜드 스타트 시 FMP 재호출 방지.
 *
 * 동시 L1 miss는 하나의 L2 조회로 접는다. 실패는 L1에 남기지 않아 다음 호출이
 * 다시 시도한다. 실패한 그 호출에는 만료된 직전 목록이 있으면 그것을, 없으면 빈 Map을
 * 돌려준다 — 1시간 경계에서 Redis·FMP가 함께 흔들려도 `crypto_assets`에 아직 없는
 * 코인이 그동안 주식으로 잘못 분류되지 않게 하기 위해서다(코인 목록은 몇 시간 늦어도 무해).
 *
 * Why store as a plain object (Record) rather than a Map in Redis:
 * Upstash serializes values with JSON.stringify; Map instances are not
 * JSON-serializable (they serialize to `{}`). We store as a Record and convert
 * to Map on read.
 *
 * ISR cold-gen safety: DYNAMIC_SERVER_USAGE is thrown by `connection()`,
 * `cookies()`, and `headers()` — NOT by no-store `fetch` calls. Both the
 * Upstash REST client and `fmpGet` use `fetch` without those dynamic APIs, so
 * they are safe inside `unstable_cache`. This mirrors the existing `getAssetInfo`
 * chain, which already calls `fmpGet` with `cache: 'no-store'` (via
 * `searchBySymbol`) inside the same `unstable_cache` wrapper — `getAssetInfoStatic`
 * JSDoc explicitly confirms: "cache/DB/FMP/koreanNameStore에 cookies()/headers()/
 * connection() 없음 → unstable_cache 래핑 안전".
 *
 * Infra/FMP failure → returns empty Map (caller degrades to null, resolution
 * falls through to stock path — no 500).
 *
 * Exported for direct use in tests; production callers use `fmpCryptoMembership`.
 */
export async function getFmpCryptoListMap(): Promise<
    Map<string, FmpCryptoEntry>
> {
    if (memo !== null && memo.expiresAt > Date.now()) return memo.map;
    inFlight ??= loadFromSharedCache().finally(() => {
        inFlight = null;
    });
    return inFlight;
}

async function loadFromSharedCache(): Promise<Map<string, FmpCryptoEntry>> {
    try {
        const record = await getOrSetCache<FmpCryptoListRecord>(
            CRYPTO_FMP_LIST_CACHE_KEY,
            SECONDS_PER_DAY,
            async () => {
                const rows = await fetchCryptoAssetList();
                return Object.fromEntries(
                    rows.map((r: CryptoAssetRow) => [
                        r.symbol.toUpperCase(),
                        { name: r.name },
                    ])
                );
            }
        );
        const map = new Map(Object.entries(record));
        memo = { map, expiresAt: Date.now() + FMP_CRYPTO_LIST_MEMORY_TTL_MS };
        return map;
    } catch (e) {
        console.warn(
            memo === null
                ? '[fmpCryptoMembership] getFmpCryptoListMap failed, degrading to empty'
                : '[fmpCryptoMembership] getFmpCryptoListMap failed, serving expired list',
            e
        );
        return memo?.map ?? new Map();
    }
}

/** L1 메모와 in-flight를 비운다(테스트 격리용). */
export function _resetFmpCryptoListMemoForTest(): void {
    memo = null;
    inFlight = null;
}

/**
 * Check FMP's cryptocurrency-list for the given symbol (uppercase-normalized).
 *
 * Returns the list entry `{ name }` if the symbol is present,
 * or `null` if absent or on any infra/FMP failure (degrade, never throw).
 *
 * This is the freshness fallback for `getAssetInfo`: when `crypto_assets` DB
 * misses (symbol not yet re-seeded), this check lets new coins resolve as crypto
 * within the 24 h cache TTL instead of 404-ing.
 */
export async function fmpCryptoMembership(
    symbol: string
): Promise<FmpCryptoEntry | null> {
    // getFmpCryptoListMap catches all infra/FMP failures internally and returns
    // an empty Map — it never throws. map.get() cannot throw. The outer try/catch
    // would be unreachable and is intentionally omitted.
    const map = await getFmpCryptoListMap();
    return map.get(symbol.toUpperCase()) ?? null;
}
