import 'server-only';
import { cache } from 'react';
import { isEtRegularSessionOpen } from '@y0ngha/siglens-core';
import { getRedisClient } from '@/shared/cache/redisClient';
import {
    SECONDS_PER_DAY,
    SECONDS_PER_HOUR,
    SECONDS_PER_MINUTE,
} from '@/shared/config/time';
import { isOpenInterestSnapshotStale } from '@/shared/lib/options/openInterestStale';
import { getOptionsProvider } from './getOptionsProvider';
import {
    getOptionsCacheLifeProfile,
    type OptionsCacheLifeProfile,
} from './optionsCacheLife';
import { rebaseOptionsSnapshot } from './rebaseOptionsSnapshot';
import { secondsUntilNextRegularOpen } from './secondsUntilNextRegularOpen';
import type { OptionsSnapshot } from '@y0ngha/siglens-core';

const adapter = getOptionsProvider();

// hasOptionsMarket cross-request 캐시 TTL — 옵션 신규 상장/폐지가 즉시
// 반영될 필요는 없고, sitemap 빌드가 매 시간 ~300 ticker × Yahoo probe로
// rate-limit을 깨는 위험이 더 큼. 6시간이면 동일 sitemap window 안에서
// 단 한 번만 fetch한다 (이슈 #439 참조).
// export — 테스트가 동일 상수를 import해 silent divergence를 차단한다.
export const HAS_OPTIONS_MARKET_TTL_SECONDS = 6 * SECONDS_PER_HOUR;

/**
 * fetchOptionsSnapshot cross-request 캐시 TTL — 시장 시간대별로 freshness
 * trade-off가 달라 세 단계로 분리한다.
 *
 * - market-open: 활성 트레이딩 중 quote/IV/volume이 실시간으로 변동하지만 옵션
 *   페이지는 분 단위 freshness면 충분. 1분이면 인기 ticker 트래픽에서도
 *   Yahoo 호출이 분당 1회로 수렴.
 * - market-closed: 정규장 외(pre/post)는 OI snapshot이 다음 정규장 직전까지
 *   거의 변하지 않는다. 30분 캐시로 충분.
 * - weekend: 주말은 Yahoo가 갱신하지 않으므로 4시간 캐시로 호출량을 최소화.
 */
export const OPTIONS_SNAPSHOT_TTL_SECONDS: Record<
    OptionsCacheLifeProfile,
    number
> = {
    'options-market-open': SECONDS_PER_MINUTE,
    'options-market-closed': 30 * SECONDS_PER_MINUTE,
    'options-weekend': 4 * SECONDS_PER_HOUR,
};

/**
 * 마지막 "정상" 스냅샷(미결제약정이 채워진 것)의 보관 기간.
 *
 * 금요일 장 마감 → 월요일 정규장 사이(주말 + 공휴일 연휴)를 덮어야 한다. 정상 값이
 * 새로 들어오면 덮어쓰므로 길게 잡아도 낡은 값이 오래 남지 않는다.
 */
export const LAST_GOOD_SNAPSHOT_TTL_SECONDS = 5 * SECONDS_PER_DAY;

/** 대체 값(last-good)을 일반 캐시 키에 둘 때의 TTL 하한 — 개장 직전에도 재조회 폭주를 막는다. */
export const SUBSTITUTED_SNAPSHOT_MIN_TTL_SECONDS = SECONDS_PER_MINUTE;

function buildHasOptionsKey(symbol: string): string {
    return `options:has-market:${symbol.toUpperCase()}`;
}

function buildSnapshotKey(symbol: string): string {
    return `options:snapshot:${symbol.toUpperCase()}`;
}

function buildLastGoodSnapshotKey(symbol: string): string {
    return `options:snapshot:last-good:${symbol.toUpperCase()}`;
}

/**
 * 미결제약정이 비어 있지 않은 스냅샷만 last-good으로 저장한다 — 호출자가 걸러서 넘긴다.
 * 저장 실패는 흡수한다(없어도 기존 동작과 같다). 저장됐는지를 돌려줘 워밍이 결과를
 * 정직하게 보고하게 한다.
 */
async function writeLastGoodSnapshot(
    redis: NonNullable<ReturnType<typeof getRedisClient>>,
    symbol: string,
    snapshot: OptionsSnapshot
): Promise<boolean> {
    const key = buildLastGoodSnapshotKey(symbol);
    try {
        await redis.set(key, snapshot, { ex: LAST_GOOD_SNAPSHOT_TTL_SECONDS });
        return true;
    } catch (error) {
        console.error('[optionsDataCache] Redis set failed for', key, error);
        return false;
    }
}

/** 일반 스냅샷 캐시 키(`options:snapshot:SYM`)에 저장한다. 실패는 흡수하고 저장 여부를 돌려준다. */
async function writeSnapshotCache(
    redis: NonNullable<ReturnType<typeof getRedisClient>>,
    symbol: string,
    snapshot: OptionsSnapshot,
    ttlSeconds: number
): Promise<boolean> {
    const key = buildSnapshotKey(symbol);
    try {
        await redis.set(key, snapshot, { ex: ttlSeconds });
        return true;
    } catch (error) {
        console.error('[optionsDataCache] Redis set failed for', key, error);
        return false;
    }
}

/** last-good을 못 쓴 이유 — 로그가 "정말 없다"와 "있는데 못 쓴다"를 구분하게 한다. */
type LastGoodUnavailableReason =
    | 'absent'
    | 'no_expiry_after_rebase'
    | 'stale_after_rebase'
    | 'read_error';

type LastGoodRead =
    | { snapshot: OptionsSnapshot }
    | { reason: LastGoodUnavailableReason };

/**
 * 저장해 둔 last-good을 오늘 기준으로 맞춰 꺼낸다. 없거나, 맞추고 나면 남는 만기가
 * 없거나, 맞춘 결과가 다시 stale로 판정되면(되살릴 가치가 없다) 그 이유를 돌려준다.
 */
async function readLastGoodSnapshot(
    redis: NonNullable<ReturnType<typeof getRedisClient>>,
    symbol: string,
    now: Date
): Promise<LastGoodRead> {
    const key = buildLastGoodSnapshotKey(symbol);
    try {
        const stored = await redis.get<OptionsSnapshot>(key);
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

interface ResolvedSnapshot {
    snapshot: OptionsSnapshot;
    /** last-good으로 대체했는지 — 일반 캐시 키의 TTL 상한을 정하는 근거. */
    substituted: boolean;
}

/**
 * Yahoo가 돌려준 `fresh`를 낼 값으로 확정한다.
 *
 * - 정상(OI 채워진) 스냅샷이면 last-good을 갱신하고 그대로 낸다.
 * - stale이고 정규장 밖이면 last-good(오늘 기준으로 맞춘 것)로 대체한다. 없으면 fresh.
 * - stale이어도 정규장 중이면 대체하지 않는다.
 */
async function resolveWithLastGood(
    redis: NonNullable<ReturnType<typeof getRedisClient>>,
    symbol: string,
    fresh: OptionsSnapshot,
    now: Date
): Promise<ResolvedSnapshot> {
    if (!isOpenInterestSnapshotStale(fresh)) {
        await writeLastGoodSnapshot(redis, symbol, fresh);
        return { snapshot: fresh, substituted: false } as const;
    }
    if (isEtRegularSessionOpen(now)) {
        return { snapshot: fresh, substituted: false } as const;
    }
    const lastGood = await readLastGoodSnapshot(redis, symbol, now);
    if ('reason' in lastGood) {
        // 커버리지 측정용 — 한국 낮에 stale을 받았는데 되살릴 last-good을 못 쓴 횟수.
        // reason=absent만 "저장된 값이 정말 없다"이고 나머지는 있는데 못 쓴 경우다.
        console.warn(
            `[optionsDataCache] last-good unavailable for ${symbol.toUpperCase()} reason=${lastGood.reason} — serving stale snapshot`
        );
        return { snapshot: fresh, substituted: false } as const;
    }
    return { snapshot: lastGood.snapshot, substituted: true } as const;
}

/**
 * 옵션 시장이 형성된 종목인지 확인한다.
 *
 * 캐시 레이어:
 *   1. React.cache — request 내 dedup (generateMetadata + page body 양쪽에서 호출 시).
 *   2. Upstash Redis — cross-request 캐시 6시간 TTL. sitemap 빌드가 같은 ticker
 *      목록을 반복 probe하지 않도록 막는다. Redis 미설정 시 graceful fallback으로
 *      Yahoo 직접 호출.
 */
export const hasOptionsMarket = cache(
    async (symbol: string): Promise<boolean> => {
        const key = buildHasOptionsKey(symbol);
        const redis = getRedisClient();
        if (redis !== null) {
            try {
                const cached = await redis.get<boolean>(key);
                if (cached !== null) return cached;
            } catch (error) {
                // Redis 일시 장애는 fallback으로 흡수 — 옵션 시장 데이터는 캐시 미스로
                // 충분히 복구된다. 로그만 남기고 계속 진행.
                console.error(
                    '[optionsDataCache] Redis get failed for',
                    key,
                    error
                );
            }
        }

        // Yahoo Finance API 일시 장애도 sitemap 빌드가 깨지지 않게 흡수한다.
        // 옵션 시장 정보는 보수적으로 false 처리해 sitemap에서 제외하고
        // 다음 요청에서 회복되면 자연스럽게 복원된다.
        let fresh: boolean;
        try {
            fresh = await adapter.hasOptionsMarket(symbol);
        } catch (error) {
            console.error(
                '[optionsDataCache] adapter.hasOptionsMarket failed for',
                key,
                error
            );
            return false;
        }

        if (redis !== null) {
            try {
                await redis.set(key, fresh, {
                    ex: HAS_OPTIONS_MARKET_TTL_SECONDS,
                });
            } catch (error) {
                console.error(
                    '[optionsDataCache] Redis set failed for',
                    key,
                    error
                );
            }
        }
        return fresh;
    }
);

/**
 * 종목의 전체 옵션 스냅샷(모든 만기)을 가져온다. 옵션 없는 종목이면 null.
 *
 * 캐시 레이어:
 *   1. React.cache — request 내 dedup (page.tsx + Server Action 같은 요청
 *      안에서 여러 번 호출돼도 한 번만 Yahoo를 친다).
 *   2. Upstash Redis — cross-request 캐시. 시장 시간대별 TTL(`OPTIONS_SNAPSHOT_TTL_SECONDS`)
 *      을 적용해 활성 트레이딩 중에는 짧게, 주말은 길게 캐시한다. Redis 미설정 시
 *      graceful fallback으로 Yahoo 직접 호출.
 *
 * **한국 시간 낮(미국 정규장 밖)에는 Yahoo가 대부분의 미결제약정을 0으로 비워 돌려준다**
 * (`isOpenInterestSnapshotStale`). 그 값을 그대로 쓰면 옵션 탭이 통째로 "—"가 된다.
 * 그래서 정상 스냅샷은 `options:snapshot:last-good:SYM`에 따로 5일 보관하고, 정규장
 * 밖에 stale이 오면 그 last-good(만기·DTE를 오늘 기준으로 다시 맞춘 것)을 대신 낸다.
 * `capturedAt`은 저장 당시 값 그대로라 화면이 "직전 정규장 기준"임을 밝힐 수 있다.
 * 정규장 중에는 대체하지 않는다 — 그 시간대의 stale은 진짜 데이터 문제다.
 * Redis가 없으면 보관할 곳이 없으므로 대체도 없다.
 *
 * `null` 결과(옵션 없는 ticker, Yahoo 일시 장애)는 negative cache로 저장하지 않는다 —
 * Yahoo가 일시적으로 실패한 경우 TTL 동안 잘못된 'no data' 상태가 굳어버릴 위험이
 * 크기 때문. `hasOptionsMarket`은 옵션 존재 여부만 묻는 가벼운 probe라 negative
 * cache가 안전하지만, snapshot은 전체 chain을 다루므로 더 보수적으로 동작한다.
 */
export const fetchOptionsSnapshot = cache(
    async (symbol: string): Promise<OptionsSnapshot | null> => {
        const key = buildSnapshotKey(symbol);
        const redis = getRedisClient();
        if (redis !== null) {
            try {
                const cached = await redis.get<OptionsSnapshot>(key);
                if (cached !== null) return cached;
            } catch (error) {
                console.error(
                    '[optionsDataCache] Redis get failed for',
                    key,
                    error
                );
            }
        }

        const fresh = await adapter.fetchSnapshot(symbol);

        // null은 캐시하지 않음 — 위 docstring 참고.
        if (fresh === null) return null;

        // 정상(OI 채워진) 스냅샷이면 last-good을 갱신하고, 정규장 밖의 stale이면
        // last-good으로 대체한다. 대체 결과도 아래에서 같은 key·TTL로 저장해, 같은
        // 시간대의 다음 요청이 Yahoo를 다시 치지 않게 한다.
        const now = new Date();
        if (redis !== null) {
            const { snapshot: result, substituted } = await resolveWithLastGood(
                redis,
                symbol,
                fresh,
                now
            );

            const profileTtl =
                OPTIONS_SNAPSHOT_TTL_SECONDS[getOptionsCacheLifeProfile(now)];
            // 대체 값은 "정규장이 닫혀 있는 동안"만 유효하다. 주말 프로파일(4h)이나 닫힘
            // 프로파일(30분)의 TTL을 그대로 쓰면 개장 직전에 저장된 값이 개장 뒤에도 남아,
            // 장중에 어제 값이 나간다. 다음 개장까지의 시간으로 상한을 둔다(최소 60초).
            const ttl = substituted
                ? Math.max(
                      SUBSTITUTED_SNAPSHOT_MIN_TTL_SECONDS,
                      Math.min(profileTtl, secondsUntilNextRegularOpen(now))
                  )
                : profileTtl;
            await writeSnapshotCache(redis, symbol, result, ttl);
            return result;
        }
        return fresh;
    }
);

/** 워밍 한 건의 결과 — `written`은 last-good을 실제로 갱신했다는 뜻이다. */
export type LastGoodRefreshResult = 'written' | 'stale' | 'none';

/**
 * 저장된 last-good의 `capturedAt`(ISO 문자열)을 돌려준다. 없거나 Redis를 못 쓰면 `null`.
 * 워밍이 "오늘 정규장 마감 이후에 이미 확보된 종목"을 건너뛰는 데 쓴다 — 오늘 기준으로
 * 맞추는 `readLastGoodSnapshot`과 달리 저장 당시 값 그대로다.
 */
export async function readLastGoodCapturedAt(
    symbol: string
): Promise<string | null> {
    const redis = getRedisClient();
    if (redis === null) return null;
    const key = buildLastGoodSnapshotKey(symbol);
    try {
        const stored = await redis.get<OptionsSnapshot>(key);
        return stored?.capturedAt ?? null;
    } catch (error) {
        console.error('[optionsDataCache] Redis get failed for', key, error);
        return null;
    }
}

/**
 * 일반 캐시(`options:snapshot:SYM`)의 hit 경로를 **우회**해 Yahoo를 직접 치고, OI가 채워진
 * (stale 아님) 스냅샷이면 last-good과 일반 캐시 키를 함께 갱신한다.
 *
 * `fetchOptionsSnapshot`은 캐시 hit 시 last-good을 갱신하지 않고, miss 때도 Yahoo가 OI를
 * 비우는 한국 낮에는 갱신 기회가 없다. 정규장 마감 직후 ~19:45 ET 사이(Yahoo가 아직 OI를
 * 들고 있는 구간)에 이 함수를 돌려 last-good 커버리지를 채운다.
 *
 * 일반 캐시 키는 지금 시각의 프로파일 TTL로 쓴다 — 방금 받은 fresh 값이라 대체 값
 * 상한(`secondsUntilNextRegularOpen`)이 필요 없다. Redis 미구성·Yahoo/Redis 오류는
 * 흡수하고 `'none'`을 돌려준다(워밍은 베스트 에포트다).
 *
 * @returns `written` — last-good 갱신됨 / `stale` — Yahoo가 OI를 비워 줌(저장 안 함) /
 *   `none` — 스냅샷 없음·Redis 미구성·오류.
 */
export async function refreshLastGoodSnapshot(
    symbol: string,
    now: Date = new Date()
): Promise<LastGoodRefreshResult> {
    const redis = getRedisClient();
    if (redis === null) return 'none';

    let fresh: OptionsSnapshot | null;
    try {
        fresh = await adapter.fetchSnapshot(symbol);
    } catch (error) {
        console.error(
            '[optionsDataCache] adapter.fetchSnapshot failed for',
            symbol.toUpperCase(),
            error
        );
        return 'none';
    }
    if (fresh === null) return 'none';
    if (isOpenInterestSnapshotStale(fresh)) return 'stale';

    const wroteLastGood = await writeLastGoodSnapshot(redis, symbol, fresh);
    if (!wroteLastGood) return 'none';
    await writeSnapshotCache(
        redis,
        symbol,
        fresh,
        OPTIONS_SNAPSHOT_TTL_SECONDS[getOptionsCacheLifeProfile(now)]
    );
    return 'written';
}
