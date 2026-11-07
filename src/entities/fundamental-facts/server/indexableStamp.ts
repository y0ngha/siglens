import 'server-only';
import { getRedisClient } from '@/shared/cache/redisClient';
import { SECONDS_PER_DAY } from '@/shared/config/time';

/**
 * 펀더멘털 탭 색인 판정을 sitemap에 넘기는 자리.
 *
 * sitemap은 종목 수(수백) × 사실 입력원(재무·수급·목표가·실적)을 직접 읽을 수 없어서, 같은
 * `getFundamentalFacts` 결과를 여기 남기고 sitemap은 한 번의 MGET으로 읽는다. 쓰는 곳은 SEO 프리웜
 * tick마다 인기 종목을 커서로 도는 단계(`cron/seo-prewarm/fundamentalStamps.ts`, 하루 두 바퀴 이상)
 * 하나다. 페이지 렌더는 쓰지 않는다 — 렌더 중 Redis 쓰기(Upstash REST no-store fetch)는 ISR 페이지를
 * 동적으로 뒤집는다(2026-11-07 e2e 실측). 페이지 자신의 robots는 이 값을 읽지 않는다 — 데이터에서 결정적으로 정한다. 그래서 이
 * 스탬프는 sitemap 등재가 프리웜 한 바퀴만큼 늦는 것 말고는 색인 판정에 영향을 주지 않는다.
 *
 * 입력이 불완전한 판정(장애 중)은 기록하지 않는다 — 장애 때의 임시 판정이 sitemap에 남지 않게.
 * 7일 동안 아무도 갱신하지 않으면(프리웜이 멈춘 경우) 키가 사라져 sitemap에서도 빠진다(보수적 기본값).
 *
 * 알려진 한계: 일부 입력원은 실패를 스스로 삼킨다(재무 `cacheNonEmpty`의 빈 배열, yahoo의 빈 결과,
 * 실적 갱신 실패). 그때는 "정상인데 사실이 적다"로 보여 `n`이 남을 수 있다 — 다음 프리웜 바퀴(반나절
 * 안)에 다시 판정되므로 받아들였다.
 */
const KEY_PREFIX = 'fundamental-indexable:v1';
export const FUNDAMENTAL_INDEXABLE_TTL_SECONDS = 7 * SECONDS_PER_DAY;

const YES = 'y';
const NO = 'n';

const keyFor = (symbol: string): string =>
    `${KEY_PREFIX}:${symbol.toUpperCase()}`;

/** 렌더 결과를 남긴다. 실패는 삼킨다 — sitemap 등재가 늦어질 뿐 페이지는 영향이 없다. */
export async function recordFundamentalIndexable(
    symbol: string,
    indexable: boolean
): Promise<void> {
    const redis = getRedisClient();
    if (redis === null) return;
    try {
        await redis.set(keyFor(symbol), indexable ? YES : NO, {
            ex: FUNDAMENTAL_INDEXABLE_TTL_SECONDS,
        });
    } catch (error) {
        console.error('[fundamentalIndexable] record failed', error);
    }
}

/**
 * 종목별 마지막 판정. 기록이 없는 종목은 맵에 없다. Redis가 없거나 실패하면 `undefined` —
 * 호출부(sitemap)는 그때 펀더멘털 URL을 하나도 싣지 않는다.
 */
export async function readFundamentalIndexableMap(
    symbols: readonly string[]
): Promise<ReadonlyMap<string, boolean> | undefined> {
    const redis = getRedisClient();
    if (redis === null || symbols.length === 0) return undefined;
    try {
        const values = await redis.mget<(string | null)[]>(
            ...symbols.map(keyFor)
        );
        const map = new Map<string, boolean>();
        symbols.forEach((symbol, i) => {
            const value = values[i];
            if (value === YES) map.set(symbol, true);
            else if (value === NO) map.set(symbol, false);
        });
        return map;
    } catch (error) {
        console.error('[fundamentalIndexable] read failed', error);
        return undefined;
    }
}
