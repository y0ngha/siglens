import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    getEntry,
    setEntry,
    __resetForTests,
    statsForTest,
    deleteEntry,
    MEM_ROUTE_MAX_BYTES,
} from '../memStore.mjs';

/** 소스에서 직접 가져온다 — 로컬 재정의는 기본값이 바뀔 때 조용히 드리프트한다. */
const ROUTE_GATE_BYTES = MEM_ROUTE_MAX_BYTES;

/** 크기를 지정한 FETCH 엔트리 — 예산 산정은 `value.data.body.length`를 본다. */
function fetchEntry(bodyLength, extra = {}) {
    return {
        value: { kind: 'FETCH', data: { body: 'x'.repeat(bodyLength) } },
        lastModified: 1,
        tags: [],
        ...extra,
    };
}

/**
 * 상한을 낮춘 memStore 인스턴스를 새로 임포트한다.
 *
 * 상한은 모듈 로드 시점에 `process.env`에서 읽는 상수라, 축출 로직을 기본값
 * (4,000개 / 64MB)으로 검증하려면 테스트가 실제로 64MB를 할당해야 한다.
 * env를 stub한 뒤 모듈을 다시 임포트해 작은 예산으로 같은 코드를 태운다.
 */
async function freshStore({ maxEntries, maxBytes }) {
    vi.resetModules();
    if (maxEntries !== undefined)
        vi.stubEnv('ISR_FETCH_CACHE_MAX_ENTRIES', String(maxEntries));
    if (maxBytes !== undefined)
        vi.stubEnv('ISR_FETCH_CACHE_MAX_BYTES', String(maxBytes));
    return import('../memStore.mjs');
}

beforeEach(() => {
    __resetForTests();
});

afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
});

describe('memStore는', () => {
    it('miss면 null을 반환한다', () => {
        expect(getEntry('none')).toBeNull();
    });

    it('저장한 엔트리를 그대로 돌려준다', () => {
        const entry = fetchEntry(10);
        setEntry('k', entry);
        expect(getEntry('k')).toBe(entry);
    });

    it('같은 키를 덮어써도 예산이 이중 계상되지 않는다', () => {
        setEntry('k', fetchEntry(100));
        setEntry('k', fetchEntry(30));

        expect(statsForTest()).toEqual({ size: 1, totalBytes: 30 });
    });

    it('body가 문자열이 아니면 기본 크기(1KB)로 계상한다', () => {
        setEntry('no-body', { value: { kind: 'FETCH', data: {} } });

        expect(statsForTest()).toEqual({ size: 1, totalBytes: 1024 });
    });

    it('크기 게이트를 넘으면 false를 반환하고 담지 않는다', () => {
        expect(setEntry('big', fetchEntry(ROUTE_GATE_BYTES + 1))).toBe(false);

        expect(getEntry('big')).toBeNull();
        expect(statsForTest()).toEqual({ size: 0, totalBytes: 0 });
    });

    it('게이트 이하면 true를 반환한다', () => {
        expect(setEntry('ok', fetchEntry(ROUTE_GATE_BYTES))).toBe(true);
    });

    it('deleteEntry가 예산까지 정확히 되돌린다', () => {
        setEntry('a', fetchEntry(100));
        setEntry('b', fetchEntry(50));
        deleteEntry('a');

        expect(getEntry('a')).toBeNull();
        expect(statsForTest()).toEqual({ size: 1, totalBytes: 50 });
        // 없는 키 삭제는 무해해야 한다(예산 훼손 없음).
        deleteEntry('없음');
        expect(statsForTest()).toEqual({ size: 1, totalBytes: 50 });
    });

    it('게이트 초과 엔트리가 다른 키를 밀어내지 않는다', () => {
        setEntry('keep', fetchEntry(50));
        setEntry('big', fetchEntry(ROUTE_GATE_BYTES + 1));

        expect(getEntry('keep')).not.toBeNull();
        expect(statsForTest()).toEqual({ size: 1, totalBytes: 50 });
    });

    it('같은 키에 게이트 초과 값을 써도 기존 엔트리를 보존한다', () => {
        // 거부는 "메모리에 두지 않는다"일 뿐 "이 키를 비운다"가 아니다. 정리 책임은
        // index.mjs에 있다(S3로 승격하며 memDelete). 게이트 검사를 삭제보다 뒤에 두면
        // 멀쩡한 옛 엔트리가 조용히 사라진다.
        const kept = fetchEntry(50);
        setEntry('k', kept);
        setEntry('k', fetchEntry(ROUTE_GATE_BYTES + 1));

        expect(getEntry('k')).toBe(kept);
        expect(statsForTest()).toEqual({ size: 1, totalBytes: 50 });
    });

    it('총 예산이 라우팅 게이트보다 작게 설정돼도 캐시가 죽지 않는다', async () => {
        // 두 값이 독립 env라 총 예산 < 게이트 설정이 가능하다. 하한이 없으면
        // 게이트를 통과한 엔트리가 삽입 직후 축출돼 히트율이 영구 0%가 된다.
        const store = await freshStore({ maxBytes: 10 });
        expect(store.setEntry('a', fetchEntry(4096))).toBe(true);

        expect(store.getEntry('a')).not.toBeNull();
    });

    it('총 바이트 상한을 넘으면 오래된 것부터 제거한다', async () => {
        const store = await freshStore({ maxBytes: 300, maxEntries: 3 });
        store.setEntry('a', fetchEntry(100));
        store.setEntry('b', fetchEntry(100));
        store.setEntry('c', fetchEntry(100));
        // 여기까지 정확히 300 — 상한 이하라 아무도 축출되지 않는다.
        expect(store.statsForTest()).toEqual({ size: 3, totalBytes: 300 });

        store.setEntry('d', fetchEntry(100));

        expect(store.getEntry('a')).toBeNull();
        expect(store.getEntry('b')).not.toBeNull();
        expect(store.getEntry('d')).not.toBeNull();
        expect(store.statsForTest().totalBytes).toBe(300);
    });

    it('엔트리 수 상한을 넘으면 오래된 것부터 제거한다', async () => {
        const store = await freshStore({ maxEntries: 2 });
        store.setEntry('a', fetchEntry(10));
        store.setEntry('b', fetchEntry(10));
        store.setEntry('c', fetchEntry(10));

        expect(store.statsForTest().size).toBe(2);
        expect(store.getEntry('a')).toBeNull();
        expect(store.getEntry('c')).not.toBeNull();
    });

    it('음수 상한 env는 기본값으로 떨어진다', async () => {
        // `Number(x) || fallback`이면 음수가 truthy라 통과하고, evictToFit의
        // `size <= -1`이 영구히 거짓이 되어 매 set마다 맵이 통째로 비워진다.
        const store = await freshStore({ maxEntries: -1, maxBytes: -1 });
        store.setEntry('a', fetchEntry(10));
        store.setEntry('b', fetchEntry(10));

        expect(store.statsForTest().size).toBe(2);
    });

    it('0·NaN 상한 env도 기본값으로 떨어진다', async () => {
        const store = await freshStore({ maxEntries: 0, maxBytes: 'abc' });
        store.setEntry('a', fetchEntry(10));

        expect(store.statsForTest().size).toBe(1);
    });

    it('hit·miss·evict 카운터를 집계한다', async () => {
        const store = await freshStore({ maxEntries: 1 });
        store.setEntry('a', fetchEntry(10));
        store.getEntry('a'); // hit
        store.getEntry('없음'); // miss
        store.setEntry('b', fetchEntry(10)); // 'a' 축출

        expect(store.countersForTest()).toEqual({
            hits: 1,
            misses: 1,
            evictions: 1,
        });
    });

    it('Infinity 상한 env도 기본값으로 떨어진다', async () => {
        // Number('Infinity')는 truthy이고 유한하지 않다 — isFinite 가드가 빠지면
        // 바이트 예산이 조용히 무한대가 되어 축출이 영원히 일어나지 않는다.
        const store = await freshStore({ maxBytes: 'Infinity' });
        for (let i = 0; i < 40; i++) store.setEntry('k' + i, fetchEntry(8000));

        // 기본값 32MB 안이므로 전부 남아야 하고, 예산은 유한해야 한다.
        expect(Number.isFinite(store.statsForTest().totalBytes)).toBe(true);
        expect(store.statsForTest().size).toBe(40);
    });

    it('상태 로그는 알람이 파싱할 수 있는 JSON 한 줄이다', async () => {
        // infra/aws/07-alarms.sh의 `{ $.event = "fetch-mem" }` 필터와 `$.evicted`
        // 등의 추출 경로가 이 형태에 걸려 있다 — 외부 계약이라 깨지면 알람이 조용히 죽는다.
        // (공백 구분 `key=value` 로그로 되돌리면 CloudWatch가 숫자를 못 뽑는다.)
        const store = await freshStore({ maxEntries: 1 });
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
        store.setEntry('a', fetchEntry(10));
        store.getEntry('a');
        store.getEntry('없음');
        store.setEntry('b', fetchEntry(10)); // 'a' 축출

        expect(spy).toHaveBeenCalled();
        const parsed = JSON.parse(spy.mock.calls[0][0]);
        expect(parsed).toMatchObject({ tag: 'isr-cache', event: 'fetch-mem' });
        for (const k of ['size', 'bytes', 'hit', 'miss', 'evicted']) {
            expect(typeof parsed[k]).toBe('number');
        }
        spy.mockRestore();
    });

    it('스로틀 창 안에서는 한 번만 로그한다', async () => {
        const store = await freshStore({});
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
        for (let i = 0; i < 5; i++) store.setEntry('k' + i, fetchEntry(10));

        expect(spy).toHaveBeenCalledTimes(1);
        spy.mockRestore();
    });

    it('읽기가 LRU 순서를 갱신해 최근 사용 항목이 살아남는다', async () => {
        const store = await freshStore({ maxEntries: 2 });
        store.setEntry('a', fetchEntry(10));
        store.setEntry('b', fetchEntry(10));
        // 'a'를 읽어 최신으로 올린다 → 다음 축출 대상은 'b'가 된다.
        expect(store.getEntry('a')).not.toBeNull();

        store.setEntry('c', fetchEntry(10));

        expect(store.getEntry('a')).not.toBeNull();
        expect(store.getEntry('b')).toBeNull();
    });
});
