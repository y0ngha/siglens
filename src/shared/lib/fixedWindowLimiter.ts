import {
    __resetMemoryLruForTests,
    createMemoryLru,
    type MemoryLru,
} from '@/shared/cache/memoryLru';

/**
 * 인스턴스 메모리 안의 키별 고정 창 카운터(보통 키는 클라이언트 IP).
 *
 * Redis가 아니라 메모리인 이유: 이 한도는 남용(스크립트 루프·무한 재시도) 차단용이라 인스턴스마다
 * 따로 세도 목적을 이룬다 — 실효 상한이 인스턴스 수만큼 늘 뿐이다. 대신 외부 의존이 없어
 * Redis가 죽어도 동작하고 요청마다 왕복을 더하지 않는다.
 *
 * 추적 키 수는 `maxTrackedKeys`로 자른다. 키를 돌려 가며 보내면 오래된 항목부터 밀려나
 * 카운트가 초기화되는데, 그건 감수한다.
 */
export interface FixedWindowLimiter {
    /** 이 키의 이번 창 카운트를 하나 늘리고, 상한 안이면 `true`. 넘쳤으면 늘리지 않고 `false`. */
    admit(key: string, now: number): boolean;
}

export interface FixedWindowLimiterOptions {
    /** 창 하나에 허용하는 요청 수. */
    limit: number;
    windowMs: number;
    /** 추적할 키 수 상한(LRU). */
    maxTrackedKeys: number;
}

interface Window {
    readonly count: number;
    readonly windowEnd: number;
}

const stores = new WeakMap<FixedWindowLimiter, MemoryLru<Window>>();

export function createFixedWindowLimiter({
    limit,
    windowMs,
    maxTrackedKeys,
}: FixedWindowLimiterOptions): FixedWindowLimiter {
    const windows = createMemoryLru<Window>(maxTrackedKeys);
    const limiter: FixedWindowLimiter = {
        admit(key, now) {
            const current = windows.get(key);
            // LRU 만료는 자기 시계(`Date.now`)로 판정하므로, 넘겨받은 `now` 기준으로도 창이
            // 끝났는지 따로 본다 — 둘이 같은 시계면 중복 검사일 뿐이다.
            if (current === undefined || current.windowEnd <= now) {
                windows.set(
                    key,
                    { count: 1, windowEnd: now + windowMs },
                    windowMs
                );
                return true;
            }
            if (current.count >= limit) return false;
            windows.set(
                key,
                { count: current.count + 1, windowEnd: current.windowEnd },
                current.windowEnd - now
            );
            return true;
        },
    };
    stores.set(limiter, windows);
    return limiter;
}

/** 테스트 전용 — `limiter`의 카운트를 모두 비운다(beforeEach에서 사용). */
export function __resetFixedWindowLimiterForTests(
    limiter: FixedWindowLimiter
): void {
    const windows = stores.get(limiter);
    if (windows !== undefined) __resetMemoryLruForTests(windows);
}
