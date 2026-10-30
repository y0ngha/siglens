import 'server-only';
import { isEtRegularSessionOpen } from '@y0ngha/siglens-core';
import { getRedisClient } from '@/shared/cache/redisClient';
import {
    decodeCacheValue,
    encodeCacheValue,
} from '@/shared/cache/cacheValueCodec';
import { MS_PER_MINUTE, SECONDS_PER_DAY } from '@/shared/config/time';
import { isOpenInterestSnapshotStale } from '@/shared/lib/options/openInterestStale';
import type { SlottedOptionsSnapshot } from '../lib/optionsSlots';
import { rebaseOptionsSnapshot } from '../lib/rebaseOptionsSnapshot';

// 로그 태그 `[optionsDataCache]`는 모듈 분리 뒤에도 의도적으로 유지한다 — grep·알림 연속성.

/** `getRedisClient()`가 null이 아닐 때의 클라이언트 — 이 모듈의 함수는 호출자가 null을 걸러 넘긴다. */
export type RedisClient = NonNullable<ReturnType<typeof getRedisClient>>;

/**
 * 마지막 "정상" 스냅샷(미결제약정이 채워진 것)의 보관 기간.
 *
 * 금요일 장 마감 → 월요일 정규장 사이(주말 + 공휴일 연휴)를 덮어야 한다. 정상 값이
 * 새로 들어오면 덮어쓰므로 길게 잡아도 낡은 값이 오래 남지 않는다.
 */
export const LAST_GOOD_SNAPSHOT_TTL_SECONDS = 5 * SECONDS_PER_DAY;

/**
 * 정규장 중 last-good 재기록 최소 간격. 장중에는 OI가 거의 늘 채워져 와서, 예전에는
 * 일반 캐시가 빗나갈 때마다(인기 종목은 분마다) 수백 KB짜리 last-good을 5일 TTL로 다시
 * 썼다. last-good은 "한국 낮에 내보낼 직전 정규장 값"이라 장중 30분 단위면 충분하고,
 * 정규장 밖(마감 뒤 OI가 확정되는 구간 포함)에는 이 간격 없이 매번 쓴다.
 */
export const LAST_GOOD_MIN_REWRITE_INTERVAL_MS = 30 * MS_PER_MINUTE;

/**
 * last-good 키(본체·`capturedAt` 보조 키)의 포맷 버전. 일반 스냅샷 키(`optionsDataCache`의
 * `SNAPSHOT_CACHE_VERSION`)와 같은 이유로 2026-10-22에 올렸다 — `normalizeYahooContract`가
 * 시장 값이 아닌 IV를 `null`로 바꾸기 시작해, 옛 키의 last-good이 들고 있는 가짜 IV를 배포
 * 직후에도 내보내지 않기 위해서다.
 * 대가: 배포 뒤 첫 워밍 구간(그날 정규장 마감 후)까지는 last-good이 없어, 정규장 밖에 처음
 * 조회된 종목은 Yahoo의 장외 값(호가 없음 → IV `null`, 내재 변동폭 `null`)을 받는다. 가짜
 * 수치 대신 "모름"이 나가는 것이라 감수한다. 보조 키도 함께 올려야 한다 — 옛 보조 키가 남으면
 * 워밍이 "이미 확보됨"으로 보고 새 last-good을 쓰지 않는다.
 */
const LAST_GOOD_CACHE_VERSION = 'v2';

function buildLastGoodSnapshotKey(symbol: string): string {
    return `options:snapshot:last-good:${LAST_GOOD_CACHE_VERSION}:${symbol.toUpperCase()}`;
}

/**
 * last-good의 `capturedAt`만 담은 작은 보조 키. 워밍이 "오늘 마감 이후 이미 확보됐나"를
 * 판정할 때 스냅샷 전체(수백 KB)를 읽지 않고 MGET 한 번으로 후보 전체를 훑게 한다.
 * last-good과 같은 TTL로 함께 쓴다.
 */
function buildLastGoodCapturedAtKey(symbol: string): string {
    return `options:snapshot:last-good-at:${LAST_GOOD_CACHE_VERSION}:${symbol.toUpperCase()}`;
}

/**
 * 미결제약정이 비어 있지 않은 스냅샷만 last-good으로 저장한다 — 호출자가 걸러서 넘긴다.
 * 저장 실패는 흡수한다(없어도 기존 동작과 같다). 저장됐는지를 돌려줘 워밍이 결과를
 * 정직하게 보고하게 한다.
 *
 * 값은 `encodeCacheValue`로 압축해 쓴다(스냅샷은 수백 KB라 zstd로 크게 준다). 압축 도입 때는
 * 키를 그대로 뒀다 — 5일짜리 값이라 키를 바꾸면 배포 직후 한국 낮 방문자가 last-good 없이
 * stale을 받는다. IV 정규화 때는 키를 올렸다 — 그 이유와 대가는 `LAST_GOOD_CACHE_VERSION` 참고.
 * 읽기(`readLastGoodSnapshot`)는 압축 전 값도 그대로 읽고, 옛 빌드가 압축 값을
 * 읽으면 `rebaseOptionsSnapshot`이 문자열에서 throw → `read_error`로 흡수된다.
 */
export async function writeLastGoodSnapshot(
    redis: RedisClient,
    symbol: string,
    snapshot: SlottedOptionsSnapshot
): Promise<boolean> {
    const key = buildLastGoodSnapshotKey(symbol);
    try {
        await redis.set(key, await encodeCacheValue(snapshot), {
            ex: LAST_GOOD_SNAPSHOT_TTL_SECONDS,
        });
    } catch (error) {
        console.error('[optionsDataCache] Redis set failed for', key, error);
        return false;
    }
    // 보조 키 실패는 흡수한다 — 없으면 워밍이 그 종목을 "미확보"로 보고 한 번 더 돌 뿐이다.
    const capturedAtKey = buildLastGoodCapturedAtKey(symbol);
    try {
        await redis.set(capturedAtKey, snapshot.capturedAt, {
            ex: LAST_GOOD_SNAPSHOT_TTL_SECONDS,
        });
    } catch (error) {
        console.error(
            '[optionsDataCache] Redis set failed for',
            capturedAtKey,
            error
        );
    }
    return true;
}

/**
 * 이번 miss에서 last-good을 다시 쓸지. 정규장 밖이면 늘 쓴다(마감 뒤 확정 OI가 가장 값진
 * last-good이다). 정규장 중에는 저장된 last-good의 `capturedAt`(작은 보조 키)이
 * `LAST_GOOD_MIN_REWRITE_INTERVAL_MS`보다 오래됐을 때만 쓴다. 보조 키가 없거나 읽기에
 * 실패하면 쓴다 — 아끼는 쪽보다 last-good을 잃는 쪽이 더 비싸다.
 */
export async function shouldRewriteLastGood(
    redis: RedisClient,
    symbol: string,
    now: Date
): Promise<boolean> {
    if (!isEtRegularSessionOpen(now)) return true;
    const key = buildLastGoodCapturedAtKey(symbol);
    try {
        const capturedAt = await redis.get<unknown>(key);
        if (typeof capturedAt !== 'string') return true;
        const capturedMs = Date.parse(capturedAt);
        return (
            !Number.isFinite(capturedMs) ||
            now.getTime() - capturedMs >= LAST_GOOD_MIN_REWRITE_INTERVAL_MS
        );
    } catch (error) {
        console.error('[optionsDataCache] Redis get failed for', key, error);
        return true;
    }
}

/** last-good을 못 쓴 이유 — 로그가 "정말 없다"와 "있는데 못 쓴다"를 구분하게 한다. */
type LastGoodUnavailableReason =
    | 'absent'
    | 'no_expiry_after_rebase'
    | 'stale_after_rebase'
    | 'read_error';

/** `readLastGoodSnapshot` 결과 — `'reason' in`으로 사용 가능 여부를 가른다. */
export type LastGoodRead =
    | { snapshot: SlottedOptionsSnapshot }
    | { reason: LastGoodUnavailableReason };

/**
 * 저장해 둔 last-good을 오늘 기준으로 맞춰 꺼낸다. 없거나, 맞추고 나면 남는 만기가
 * 없거나, 맞춘 결과가 다시 stale로 판정되면(되살릴 가치가 없다) 그 이유를 돌려준다.
 */
export async function readLastGoodSnapshot(
    redis: RedisClient,
    symbol: string,
    now: Date
): Promise<LastGoodRead> {
    const key = buildLastGoodSnapshotKey(symbol);
    try {
        // 압축 값(이 빌드 이후)과 압축 전 값(이전 빌드가 쓴 것) 모두 같은 객체로 돌아온다.
        // safe: 이 키에는 `writeLastGoodSnapshot`만 쓰며, 그 값은 언제나 `OptionsSnapshot`이다.
        const stored = (await decodeCacheValue(
            await redis.get<unknown>(key)
        )) as SlottedOptionsSnapshot | null;
        if (stored === null) return { reason: 'absent' };
        const rebased = rebaseOptionsSnapshot(stored, now);
        if (rebased === null) return { reason: 'no_expiry_after_rebase' };
        if (isOpenInterestSnapshotStale(rebased)) {
            return { reason: 'stale_after_rebase' };
        }
        return { snapshot: rebased };
    } catch (error) {
        console.error('[optionsDataCache] Redis get failed for', key, error);
        return { reason: 'read_error' };
    }
}

/**
 * 여러 종목의 last-good `capturedAt`(ISO 문자열)을 보조 키 MGET 한 번으로 읽는다. 값이
 * 없는 종목(보조 키 도입 전에 저장됐거나 만료·미저장)은 결과 맵에 없다 — 호출자는 "없음 =
 * 미확보"로 다룬다. Redis가 없거나 오류면 빈 맵이다(워밍이 전부 미확보로 보고 진행한다).
 *
 * 오늘 기준으로 맞추는 `readLastGoodSnapshot`과 달리 저장 당시 값 그대로다.
 */
export async function readLastGoodCapturedAtBatch(
    symbols: readonly string[]
): Promise<ReadonlyMap<string, string>> {
    const redis = getRedisClient();
    if (redis === null || symbols.length === 0) return new Map();
    try {
        const values = await redis.mget<unknown[]>(
            ...symbols.map(buildLastGoodCapturedAtKey)
        );
        return new Map(
            symbols.flatMap((symbol, index) => {
                const value = values[index];
                return typeof value === 'string'
                    ? [[symbol, value] as const]
                    : [];
            })
        );
    } catch (error) {
        console.error(
            '[optionsDataCache] Redis mget failed for last-good captured-at',
            error
        );
        return new Map();
    }
}
