import type { Bar } from '@y0ngha/siglens-core';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { type MemoryLru, createMemoryLru } from '@/shared/cache/memoryLru';
import {
    MS_PER_SECOND,
    SECONDS_PER_DAY,
    SECONDS_PER_MINUTE,
} from '@/shared/config/time';
import type { EodHistoryEntry } from './eodHistoryMerge';

/** 히스토리 L1에 담는 값 — 일봉은 {@link EodHistoryEntry}, 인트라데이는 `Bar[]`. */
export type HistoryMemory = MemoryLru<Bar[] | EodHistoryEntry>;

type HistoryMemoryValue = HistoryMemory extends MemoryLru<infer V> ? V : never;

/**
 * 히스토리 L1을 만든다 — 일봉·인트라데이를 한 LRU에 섞어 담는 값 타입을 한곳에 고정해,
 * provider가 인스턴스마다 제네릭 인자를 되풀이하지 않게 한다.
 */
export function createHistoryMemory(maxEntries: number): HistoryMemory {
    return createMemoryLru<HistoryMemoryValue>(maxEntries);
}

/**
 * 히스토리(`bars:eodhist`·`bars:intrahist`) L1 메모리 상한(provider 인스턴스당).
 *
 * 5년 일봉 히스토리 한 벌이 힙에서 ~110KB(봉 ~1,360개)다. 128개면 ~14MB이고, provider
 * 싱글톤이 세션별로 셋(US·크립토·KR)이라 최악 ~42MB다. 섹터 스캔(미국 ~80종목)과
 * 종목 페이지의 뜨거운 종목을 함께 덮는 크기다.
 *
 * 재측정: `node --expose-gc`에서 5년 일봉 `Bar[]` N벌을 만들어 두기 전후에 `gc()` →
 * `process.memoryUsage().heapUsed`를 재고, 증가분 ÷ N이 한 벌의 크기다.
 */
export const HISTORY_MEMORY_MAX_ENTRIES = 128;

/**
 * 히스토리 L1의 TTL 상한. 유효성은 엔트리의 `asOf`·`checkedAt`이 정하지만(L1 hit에도 같은
 * 판정을 한다), 다른 인스턴스가 Redis 쪽을 먼저 갱신할 수 있다. 메모리 쪽이 그보다 오래 낡은
 * 값을 쥐지 않도록 30분마다 Redis를 다시 본다 — 그 비용은 키당 GET 한 번이다.
 */
export const HISTORY_MEMORY_TTL_CAP_SECONDS = 30 * SECONDS_PER_MINUTE;

/**
 * 인트라데이 히스토리 키(`bars:intrahist:...:<오늘>`)의 TTL. 키에 "오늘" 날짜가 들어가
 * 날짜가 넘어가면 다시 읽히지 않으므로, TTL은 하루를 넘지 않게 두는 정리용 상한일 뿐이다.
 */
export const INTRADAY_HISTORY_TTL_SECONDS = SECONDS_PER_DAY;

/**
 * 비어 있는 인트라데이 오늘 tail의 TTL 상한. 개장 전·주말에는 정상적으로 비지만, 장 마감
 * 뒤 FMP가 일시적으로 빈 배열을 준 것일 수도 있다 — 그 값을 다음 개장까지(최대 24h) 굳히면
 * 오늘 봉이 통째로 사라지므로 길게 두지 않는다. 장중 TTL(60초)보다 길어지는 일은 없다.
 */
export const EMPTY_INTRADAY_TAIL_MAX_TTL_SECONDS = 15 * SECONDS_PER_MINUTE;

/**
 * 히스토리 키 읽기: L1 메모리 → `getOrSetCache`(Redis + in-flight dedup) 순. 빈 결과는
 * 어느 쪽에도 두지 않는다. `isFresh`는 L1 hit에도 똑같이 적용한다 — 넓은 기준으로 저장된
 * 값만 좁은 요청을 덮는다(`getOrSetCache`의 isFresh 규약과 같다).
 */
export async function readCachedHistory(
    memory: HistoryMemory,
    key: string,
    ttlSeconds: (bars: Bar[]) => number,
    fetcher: () => Promise<Bar[]>,
    isFresh: (bars: Bar[]) => boolean
): Promise<Bar[]> {
    const memo = memory.get(key);
    if (memo !== undefined && Array.isArray(memo) && isFresh(memo)) return memo;
    const bars = await getOrSetCache<Bar[]>(
        key,
        ttlSeconds,
        fetcher,
        fetched => fetched.length > 0,
        isFresh
    );
    if (bars.length > 0 && isFresh(bars)) {
        memory.set(
            key,
            bars,
            Math.min(ttlSeconds(bars), HISTORY_MEMORY_TTL_CAP_SECONDS) *
                MS_PER_SECOND
        );
    }
    return bars;
}
