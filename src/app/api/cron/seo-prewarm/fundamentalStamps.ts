import 'server-only';
import { getFundamentalFacts } from '@/entities/fundamental-facts/server/getFundamentalFacts';
import { recordFundamentalIndexable } from '@/entities/fundamental-facts/server/indexableStamp';
import { getProfileResilient } from '@/entities/ticker/server/getProfileResilient';
import { getRedisClient } from '@/shared/cache/redisClient';
import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';

/**
 * 펀더멘털 탭 색인 판정 스탬프(`fundamental-indexable:v1:*`)를 크론이 직접 채운다.
 *
 * sitemap은 이 스탬프로만 `/{ticker}/fundamental`을 싣고, 스탬프를 쓰는 곳은 여기뿐이다(페이지
 * 렌더 중 Redis 쓰기는 ISR을 동적으로 뒤집는다). 이 탭은 2026-11-07까지 noindex라 방문도 드물다.
 * 그래서 프리웜 tick마다 인기 종목을 커서로 `FUNDAMENTAL_STAMPS_PER_TICK`개씩 돌며
 * 페이지 `generateMetadata`와 같은 판정(프로필 degrade·부재 → noindex, 아니면 사실 게이트)을 낸다
 * — 하루 tick(≈109) × 8이면 하루에 두 바퀴 넘게 돈다.
 *
 * 심볼 배치 뒤, 데드라인 안에서만, 순차로 돈다(FMP 동시성을 늘리지 않는다). 종목 하나는
 * `FUNDAMENTAL_STAMP_TIMEOUT_MS`를 넘기면 기다리기를 포기한다 — 배치 데드라인은 wall-clock 예산에서
 * `UNIT_TIMEOUT_MS`(120초)를 미리 빼 두므로, 데드라인 직전에 시작한 종목이 이 상한까지 걸려도 락
 * TTL을 넘기지 않는다(runPrewarmBatch.ts의 FIX G 불변식). 입력이 불완전한 판정은 남기지 않는다.
 * 어떤 실패도 던지지 않는다 — 프리웜 본 작업을 막으면 안 된다.
 */
export const FUNDAMENTAL_STAMPS_PER_TICK = 8;
/** 종목 하나의 대기 상한. `UNIT_TIMEOUT_MS`(120초)보다 작아야 위 불변식이 선다. */
export const FUNDAMENTAL_STAMP_TIMEOUT_MS = 30_000;
const CURSOR_KEY = 'fundamental-indexable:v1:cursor';

export interface FundamentalStampCounts {
    /** 시도한 종목 수(타임아웃·실패 포함) — 커서를 이만큼 민다. */
    readonly checked: number;
    readonly recorded: number;
}

type Sleep = (ms: number) => Promise<void>;
const defaultSleep: Sleep = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

/** 페이지 메타데이터와 같은 판정. `null`이면 판정할 수 없어 스탬프를 남기지 않는다. */
async function decide(symbol: string): Promise<boolean | null> {
    const { profile, degraded } = await getProfileResilient(symbol);
    if (degraded) return null;
    if (profile === null) return false;
    const result = await getFundamentalFacts(symbol);
    return result.complete ? result.indexable : null;
}

export async function refreshFundamentalStamps(
    isPastDeadline: () => boolean,
    tickers: readonly string[] = POPULAR_TICKERS,
    sleep: Sleep = defaultSleep
): Promise<FundamentalStampCounts> {
    const redis = getRedisClient();
    if (redis === null || tickers.length === 0) {
        return { checked: 0, recorded: 0 };
    }
    let start = 0;
    try {
        const raw = Number(await redis.get(CURSOR_KEY));
        start = Number.isInteger(raw) && raw >= 0 ? raw % tickers.length : 0;
        // 처리 전에 한 tick 분량만큼 먼저 민다 — 도중에 프로세스가 죽어도 같은 종목에서 막히지 않는다.
        // 끝까지 돌면 아래에서 실제로 시도한 수만큼으로 다시 맞춘다.
        await redis.set(
            CURSOR_KEY,
            (start + FUNDAMENTAL_STAMPS_PER_TICK) % tickers.length
        );
    } catch (error) {
        console.error('[seo-prewarm] fundamental stamps cursor failed', error);
        return { checked: 0, recorded: 0 };
    }

    let checked = 0;
    let recorded = 0;
    for (let i = 0; i < FUNDAMENTAL_STAMPS_PER_TICK; i++) {
        if (isPastDeadline()) break;
        const symbol = tickers[(start + i) % tickers.length];
        if (symbol === undefined) break;
        checked += 1;
        try {
            const verdict = await Promise.race([
                decide(symbol),
                sleep(FUNDAMENTAL_STAMP_TIMEOUT_MS).then(
                    () => 'timeout' as const
                ),
            ]);
            if (verdict === 'timeout') {
                console.warn(
                    `[seo-prewarm] fundamental stamp ${symbol} timed out — abandoned wait`
                );
                continue;
            }
            if (verdict === null) continue;
            await recordFundamentalIndexable(symbol, verdict);
            recorded += 1;
        } catch (error) {
            console.error(
                `[seo-prewarm] fundamental stamp ${symbol} failed`,
                error
            );
        }
    }
    if (checked < FUNDAMENTAL_STAMPS_PER_TICK) {
        // 데드라인으로 일찍 멈췄으면 남은 종목을 다음 tick이 이어받게 시도한 수만큼만 민다.
        try {
            await redis.set(CURSOR_KEY, (start + checked) % tickers.length);
        } catch (error) {
            console.error(
                '[seo-prewarm] fundamental stamps cursor failed',
                error
            );
        }
    }
    return { checked, recorded };
}
