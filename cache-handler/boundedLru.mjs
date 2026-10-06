// 개수·바이트·TTL로 묶인 작은 LRU. 페이지 메모리 계층(pageMemStore.mjs)과 S3 404
// 네거티브 캐시(index.mjs)가 공유한다.
//
// FETCH 계층(memStore.mjs)은 이걸 쓰지 않는다 — 그쪽은 크기 게이트·킬 스위치·운영 로그가
// 얽힌 별도 설계이고 실측 근거가 주석에 묶여 있어, 동작을 그대로 두기 위해 손대지 않았다.
// LRU 순서는 Map의 삽입 순서로 표현한다(조회 시 재삽입). memStore와 같은 관례다.

/**
 * 양의 유한값만 받고 나머지는 기본값으로 떨어뜨린다(memStore.mjs `readPositiveBound`와 같은
 * 규칙 — 음수가 truthy로 통과하면 축출 조건이 영구히 거짓이 되어 매 set마다 맵이 비워진다).
 */
export function readPositiveBound(name, fallback) {
    const raw = Number(process.env[name]);
    return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

/**
 * @param {{
 *   maxEntries: number,
 *   maxBytes?: number,
 *   ttlMs: number,
 *   clock?: () => number,
 * }} options
 */
export function createBoundedLru({
    maxEntries,
    maxBytes = Infinity,
    ttlMs,
    clock = Date.now,
}) {
    /** @type {Map<string, { value: unknown, bytes: number, expiresAt: number }>} */
    const store = new Map();
    let totalBytes = 0;
    let evictions = 0;

    function remove(key) {
        const held = store.get(key);
        if (held === undefined) return;
        store.delete(key);
        totalBytes -= held.bytes;
    }

    function evictToFit() {
        for (const key of store.keys()) {
            if (store.size <= maxEntries && totalBytes <= maxBytes) return;
            remove(key);
            evictions += 1;
        }
    }

    return {
        get(key) {
            const held = store.get(key);
            if (held === undefined) return undefined;
            if (held.expiresAt <= clock()) {
                remove(key);
                return undefined;
            }
            // LRU: 재삽입으로 최근 사용 항목을 순서 끝으로 민다.
            store.delete(key);
            store.set(key, held);
            return held.value;
        },

        /**
         * 받아들이면 true. 한 항목이 예산 전체보다 크면 거부한다 — 넣는 순간 자기 자신까지
         * 포함해 전부 축출되며 다른 항목만 날리는 결과가 된다. 거부 시 같은 키의 옛 값은
         * **지운다**(호출부가 새 값을 다른 곳에 두므로, 옛 값이 남으면 낡은 쪽이 먼저 읽힌다).
         */
        set(key, value, bytes = 0) {
            remove(key);
            if (bytes > maxBytes) return false;
            store.set(key, { value, bytes, expiresAt: clock() + ttlMs });
            totalBytes += bytes;
            evictToFit();
            return true;
        },

        delete: remove,

        clear() {
            store.clear();
            totalBytes = 0;
            evictions = 0;
        },

        stats() {
            return { size: store.size, totalBytes, evictions };
        },
    };
}
