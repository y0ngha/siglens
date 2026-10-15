import 'server-only';
import { getRedisClient } from '@/shared/cache/redisClient';
import { SECONDS_PER_DAY } from '@/shared/config/time';

/**
 * CUSIP 매핑을 시도했지만 얻지 못한 심볼의 "최근 실패" 표식(Redis).
 *
 * 매핑이 영영 안 되는 심볼(ETF·펀드·CUSIP 없는 프로필)이 후보 목록 앞쪽을 계속 차지해 뒤쪽이
 * 굶는 것을 막는다. DB 테이블을 하나 더 만들지 않고 TTL 키로 둔 이유: 이 정보는 틀려도 비용이
 * "한 번 더 FMP를 부르는 것"뿐인 휘발성 힌트다. Redis가 없으면 표식을 쓰지도 읽지도 않아 매번
 * 재시도한다(정확성엔 영향 없음).
 */
export const MISS_TTL_SECONDS = {
    /** FMP 프로필이 비어 있다 — 상폐·잘못된 심볼일 수 있어 한 달 뒤 다시 본다. */
    noProfile: 30 * SECONDS_PER_DAY,
    /** ETF·펀드 — 보통주가 아니다. 거의 안 바뀐다. */
    notCommonStock: 90 * SECONDS_PER_DAY,
    /** 프로필에 CUSIP도 ISIN도 없다. */
    noCusip: 30 * SECONDS_PER_DAY,
    /** ISIN에서 낸 CUSIP을 OpenFIGI가 다른 티커로 해석했다. */
    figiMismatch: 30 * SECONDS_PER_DAY,
    /**
     * 같은 심볼이 `INVESTOR_FLOWS_CUSIP_FAILURE_THRESHOLD`번 연속 인프라 오류(FMP 402·400·5xx, OpenFIGI 장애)로 실패했다.
     * 오류가 영구적일 수 있어 후보 목록에서 빼되(그래야 전수 한 바퀴가 끝난다), 일시 장애였을 수도 있으니 일주일 뒤 다시 본다.
     */
    persistentError: 7 * SECONDS_PER_DAY,
} as const;

/** 연속 실패 카운터의 수명 — 이 안에 임계에 닿지 않으면 "연속"이 아니라고 보고 잊는다. */
const FAILURE_COUNT_TTL_SECONDS = 7 * SECONDS_PER_DAY;

const keyOf = (symbol: string): string =>
    `investor-flows:cusip-miss:v1:${symbol}`;
const failureDayKeyOf = (symbol: string, day: string): string =>
    `investor-flows:cusip-fail-day:v1:${symbol}:${day}`;
const FAILURE_DAY_TTL_SECONDS = 2 * SECONDS_PER_DAY;
const failureKeyOf = (symbol: string): string =>
    `investor-flows:cusip-fail:v1:${symbol}`;
const MGET_CHUNK = 500;

export interface CusipMissStore {
    /** `symbols` 중 최근 실패로 표식된 것. */
    findRecentMisses(symbols: readonly string[]): Promise<Set<string>>;
    recordMisses(
        entries: readonly { symbol: string; ttlSeconds: number }[]
    ): Promise<void>;
    /**
     * 인프라 오류로 실패한 심볼들의 **연속 실패 일수**를 올리고(심볼당 `day`(UTC 날짜 `YYYY-MM-DD`)마다 **최대 1번** — 같은 날
     * 여러 번 돌려도 한 번이다, `SET NX` 일 표식), `threshold`번째 실패한 심볼에는 `missTtlSeconds`짜리 miss를
     * 건다(카운터는 지운다). 일시 장애는 임계 전에 다음 실행에서 다시 시도되고, 영구 오류는 임계 뒤 miss로 후보에서 빠진다 —
     * miss가 만료되면 다시 후보가 된다. miss가 걸린 심볼을 돌려준다. Redis가 없거나 실패하면 빈 배열(표식 없음).
     */
    recordFailures(
        symbols: readonly string[],
        threshold: number,
        missTtlSeconds: number,
        day: string
    ): Promise<string[]>;
}

export function createRedisCusipMissStore(): CusipMissStore {
    return {
        async findRecentMisses(symbols) {
            const redis = getRedisClient();
            if (redis === null || symbols.length === 0) return new Set();
            const misses = new Set<string>();
            for (let i = 0; i < symbols.length; i += MGET_CHUNK) {
                const chunk = symbols.slice(i, i + MGET_CHUNK);
                try {
                    // react-doctor-disable-next-line react-doctor/async-await-in-loop
                    const values = await redis.mget<unknown[]>(
                        ...chunk.map(keyOf)
                    );
                    chunk.forEach((symbol, index) => {
                        if (
                            values[index] !== null &&
                            values[index] !== undefined
                        ) {
                            misses.add(symbol);
                        }
                    });
                } catch (error) {
                    console.error('[cusip-miss] mget failed:', error);
                    return misses;
                }
            }
            return misses;
        },
        async recordMisses(entries) {
            const redis = getRedisClient();
            if (redis === null || entries.length === 0) return;
            try {
                const pipeline = redis.pipeline();
                for (const { symbol, ttlSeconds } of entries) {
                    pipeline.set(keyOf(symbol), '1', { ex: ttlSeconds });
                }
                await pipeline.exec();
            } catch (error) {
                console.error('[cusip-miss] record failed:', error);
            }
        },
        async recordFailures(allSymbols, threshold, missTtlSeconds, day) {
            const redis = getRedisClient();
            if (redis === null || allSymbols.length === 0) return [];
            try {
                // 하루 한 번만 센다: 오늘 표식을 처음 세우는(SET NX) 심볼만 카운터를 올린다.
                const gate = redis.pipeline();
                for (const symbol of allSymbols) {
                    gate.set(failureDayKeyOf(symbol, day), '1', {
                        nx: true,
                        ex: FAILURE_DAY_TTL_SECONDS,
                    });
                }
                const gated = (await gate.exec()) as unknown[];
                const symbols = allSymbols.filter(
                    (_, index) =>
                        gated[index] !== null && gated[index] !== undefined
                );
                if (symbols.length === 0) return [];
                const counting = redis.pipeline();
                for (const symbol of symbols)
                    counting.incr(failureKeyOf(symbol));
                const counts = (await counting.exec()) as number[];
                const marked = symbols.filter(
                    (_, index) => Number(counts[index]) >= threshold
                );
                const writing = redis.pipeline();
                symbols.forEach((symbol, index) => {
                    if (Number(counts[index]) >= threshold) {
                        writing.set(keyOf(symbol), '1', { ex: missTtlSeconds });
                        writing.del(failureKeyOf(symbol));
                    } else {
                        // 첫 실패(또는 수명이 없는 카운터)에만 수명을 단다 — 매번 갱신하면 영영 만료되지 않는다.
                        writing.expire(
                            failureKeyOf(symbol),
                            FAILURE_COUNT_TTL_SECONDS,
                            'NX'
                        );
                    }
                });
                await writing.exec();
                return marked;
            } catch (error) {
                console.error('[cusip-miss] record failures failed:', error);
                return [];
            }
        },
    };
}
