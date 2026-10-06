/**
 * 인스턴스 메모리 안의 작은 LRU + 항목별 만료. Redis(L2) 앞에 두는 L1이다.
 *
 * ## 왜 필요한가
 *
 * 운영은 EC2 한 대라 같은 키를 읽는 요청이 거의 모두 같은 프로세스에 도착한다. 그런데
 * 수백 KB짜리 값(봉+지표, 5년 일봉 히스토리)을 Redis에서 매번 받아 오면, 값이 바뀌지
 * 않았는데도 Upstash 왕복 대역폭이 요청 수만큼 나간다. 메모리에 한 벌 두면 그 왕복이
 * 사라진다. 인스턴스 간 공유는 안 되지만 목적이 정합성이 아니라 egress 절감이라 충분하다
 * (`getOrSetCache`의 in-flight 맵과 같은 논리).
 * (재확인: 대수는 ASG in-service 수, 사양은 launch template의 인스턴스 타입 —
 *  `aws autoscaling describe-auto-scaling-groups`로 본다.)
 *
 * ## 상한
 *
 * 항목 수로 자른다(바이트를 재려면 직렬화가 필요해 L1을 두는 의미가 없어진다). 호출부가
 * 값 하나의 대략적 힙 크기를 알고 `maxEntries`를 정한다. `Map`은 삽입 순서를 기억하므로
 * 읽을 때 지우고 다시 넣으면 가장 최근으로 옮겨지고, 넘치면 맨 앞(가장 오래 안 쓴 것)을
 * 버린다.
 *
 * ## 값 공유
 *
 * 같은 객체를 여러 요청이 나눠 쓴다 — Redis에서 매번 새로 역직렬화하던 때와 다르다.
 * 호출부는 돌려받은 값을 **변경하지 않는다**(저장소 전체가 불변 갱신 규약을 따른다).
 */
export interface MemoryLru<T> {
    /** 만료 전이면 값을, 없거나 만료됐으면 `undefined`. 읽으면 최근 사용으로 옮긴다. */
    get(key: string): T | undefined;
    /** `ttlMs` 동안 보관한다. `ttlMs <= 0`이면 저장하지 않는다. */
    set(key: string, value: T, ttlMs: number): void;
}

interface Entry<T> {
    value: T;
    expiresAt: number;
}

const resetHandles = new WeakMap<MemoryLru<never>, () => void>();

/**
 * @param maxEntries 보관할 최대 항목 수(1 이상).
 * @param now 시계 — 테스트에서 주입한다.
 */
export function createMemoryLru<T>(
    maxEntries: number,
    // 호출 시점에 `Date.now`를 찾는다 — 참조를 미리 잡아 두면 가짜 타이머가 시계를 바꿔도
    // 모르는 채 실제 시각을 읽는다.
    now: () => number = () => Date.now()
): MemoryLru<T> {
    const entries = new Map<string, Entry<T>>();
    const instance: MemoryLru<T> = {
        get(key) {
            const entry = entries.get(key);
            if (entry === undefined) return undefined;
            entries.delete(key);
            if (entry.expiresAt <= now()) return undefined;
            entries.set(key, entry);
            return entry.value;
        },
        set(key, value, ttlMs) {
            entries.delete(key);
            if (ttlMs <= 0) return;
            entries.set(key, { value, expiresAt: now() + ttlMs });
            // 넘친 만큼 가장 오래 안 쓴 항목부터 버린다. Map 순회는 삽입 순서다.
            for (const oldest of entries.keys()) {
                if (entries.size <= maxEntries) break;
                entries.delete(oldest);
            }
        },
    };
    resetHandles.set(instance as MemoryLru<never>, () => entries.clear());
    return instance;
}

/** 테스트 전용 — `instance`의 항목을 모두 비운다(beforeEach에서 사용). */
export function __resetMemoryLruForTests<T>(instance: MemoryLru<T>): void {
    resetHandles.get(instance as MemoryLru<never>)?.();
}
