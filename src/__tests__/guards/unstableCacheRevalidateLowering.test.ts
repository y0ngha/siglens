import { readFileSync } from 'node:fs';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `src/shared/cache/buildDegradedRevalidate.ts` 전제 가드.
 *
 * 그 헬퍼는 렌더 중 `unstable_cache(..., { revalidate: 60 })`를 불러 페이지 revalidate를
 * 낮춘다. 빌드뿐 아니라 **런타임 ISR 재생성**에서도 같은 분기를 탄다 — 런타임 degrade
 * (`getBarsStatic`·`getSeoSnapshotsStatic` 실패 → 300초 핀, 빌드 degrade는 60초)가 이 전제에 기댄다. 공개 문서가 보장하는 동작이 아니라 Next 내부 구현(중첩되지 않은 호출이
 * prerender 스토어의 `revalidate`를 min으로 낮추는 분기)에 기대므로, Next를 올렸을 때
 * 그 분기가 사라지면 빌드 degrade 페이지가 조용히 라우트 기본 revalidate(1h~24h)로
 * 굳는다. 설치된 소스를 직접 읽어 분기가 남아 있는지 고정한다.
 */
const require = createRequire(import.meta.url);
const SOURCE = readFileSync(
    require.resolve('next/dist/server/web/spec-extension/unstable-cache.js'),
    'utf8'
);
const HINT =
    'Next 업그레이드로 unstable_cache의 revalidate 하향 분기가 바뀌었다 — ' +
    'src/shared/cache/buildDegradedRevalidate.ts의 degrade revalidate 핀(빌드 60초·런타임 300초)을 재검증할 것';

/** 중첩 판정(`isNestedUnstableCache = true`)을 포함한 store-type switch 블록. */
function storeTypeSwitch(): string {
    const nestedAt = SOURCE.indexOf('isNestedUnstableCache = true');
    const switchAt = SOURCE.lastIndexOf('switch(workUnitStore.type)', nestedAt);
    return nestedAt === -1 || switchAt === -1
        ? ''
        : SOURCE.slice(switchAt, nestedAt);
}

describe('next unstable_cache — prerender revalidate 하향 분기', () => {
    it('store-type switch와 중첩 unstable-cache 판정이 존재한다', () => {
        expect(storeTypeSwitch(), HINT).not.toBe('');
    });

    it('prerender-legacy 스토어(cacheComponents 비활성 ISR)를 그 분기가 다룬다', () => {
        expect(storeTypeSwitch(), HINT).toContain("case 'prerender-legacy':");
    });

    it('더 짧은 revalidate로만 스토어 값을 낮춘다', () => {
        const block = storeTypeSwitch();
        expect(block, HINT).toContain('workUnitStore.revalidate < revalidate');
        expect(block, HINT).toContain('workUnitStore.revalidate = revalidate');
    });
});

/**
 * 런타임 ISR 경로 — 같은 분기를 **실제로 실행**해 확인한다. 소스 문자열 검사만으로는
 * "분기가 있다"만 알 뿐, 그 분기가 `isStaticGeneration` 렌더(= 런타임 ISR 재생성)에서
 * 도달하는지, 콜백이 던졌을 때 stale 엔트리가 반환되는지는 보장하지 못한다.
 *
 * Next는 cacheComponents 비활성 라우트의 정적 생성·ISR 재생성을 모두 `prerender-legacy`
 * 스토어로 렌더하고(`app-render.js`의 "regular static generation" 분기), 그 스토어의
 * `revalidate`를 응답의 s-maxage·재생성 주기(`collectedRevalidate`)로 쓴다.
 */
const nextRequire = createRequire(import.meta.url);
// Next 서버 부트스트랩이 하는 일을 흉내 낸다 — `async-local-storage.js`가 이 전역을 요구한다.
// 파일 안에서만 쓰이고(vitest 파일별 격리) 다른 테스트로 새지 않는다.
Object.assign(globalThis, { AsyncLocalStorage });
const { unstable_cache } = nextRequire(
    'next/dist/server/web/spec-extension/unstable-cache.js'
) as typeof import('next/cache');
const { workAsyncStorage } = nextRequire(
    'next/dist/server/app-render/work-async-storage.external.js'
);
const { workUnitAsyncStorage } = nextRequire(
    'next/dist/server/app-render/work-unit-async-storage.external.js'
);

const INFINITE_CACHE = 0xfffffffe;

interface LegacyStore {
    type: 'prerender-legacy';
    phase: 'render';
    revalidate: number;
    expire: number;
    stale: number;
    tags: string[] | null;
    implicitTags: { tags: string[] };
    rootParams: Record<string, never>;
}

function legacyStore(): LegacyStore {
    return {
        type: 'prerender-legacy',
        phase: 'render',
        revalidate: INFINITE_CACHE,
        expire: INFINITE_CACHE,
        stale: INFINITE_CACHE,
        tags: [],
        implicitTags: { tags: [] },
        rootParams: {},
    };
}

interface FakeEntry {
    isStale: boolean;
    value: { kind: 'FETCH'; data: { body: string } };
}

function fakeIncrementalCache(entry: FakeEntry | null) {
    return {
        isOnDemandRevalidate: false,
        generateSimpleCacheKey: async (key: string) => key,
        get: async () => entry,
        set: async () => undefined,
    };
}

function runAsIsr<T>(
    store: LegacyStore,
    entry: FakeEntry | null,
    body: () => Promise<T>
): Promise<T> {
    const workStore = {
        route: '/[locale]/[symbol]',
        isStaticGeneration: true,
        isOnDemandRevalidate: false,
        isDraftMode: false,
        fetchCache: undefined,
        nextFetchId: 1,
        pendingRevalidates: undefined,
        incrementalCache: fakeIncrementalCache(entry),
    };
    return workAsyncStorage.run(workStore, () =>
        workUnitAsyncStorage.run(store, body)
    );
}

describe('next unstable_cache — 런타임 ISR 재생성에서의 동작', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('app-render가 prerender-legacy 스토어의 revalidate를 응답 재생성 주기로 쓴다', () => {
        const appRender = readFileSync(
            require.resolve('next/dist/server/app-render/app-render.js'),
            'utf8'
        );
        expect(appRender, HINT).toContain("type: 'prerender-legacy'");
        expect(appRender, HINT).toContain(
            'collectedRevalidate: prerenderLegacyStore.revalidate'
        );
    });

    it('isStaticGeneration 렌더에서 60초 핀이 스토어 revalidate를 60으로 낮춘다', async () => {
        const store = legacyStore();
        const pin = unstable_cache(async () => true, ['pin-test'], {
            revalidate: 60,
        });

        await runAsIsr(store, null, () => pin());

        expect(store.revalidate, HINT).toBe(60);
    });

    it('런타임 degrade 핀(300초)도 6h 스토어를 300으로 낮추고 더 짧은 값은 건드리지 않는다', async () => {
        const pin = unstable_cache(async () => true, ['runtime-pin-test'], {
            revalidate: 300,
        });
        const store = legacyStore();
        store.revalidate = 21600;
        await runAsIsr(store, null, () => pin());
        expect(store.revalidate, HINT).toBe(300);

        const shorter = legacyStore();
        shorter.revalidate = 60;
        await runAsIsr(shorter, null, () => pin());
        expect(shorter.revalidate, HINT).toBe(60);
    });

    it('핀이 캐시 HIT(fresh)여도 스토어 revalidate를 낮춘다', async () => {
        const store = legacyStore();
        const pin = unstable_cache(async () => true, ['pin-hit-test'], {
            revalidate: 60,
        });
        const fresh: FakeEntry = {
            isStale: false,
            value: { kind: 'FETCH', data: { body: 'true' } },
        };

        await runAsIsr(store, fresh, () => pin());

        expect(store.revalidate, HINT).toBe(60);
    });

    it('더 긴 revalidate는 이미 낮춰진 스토어 값을 되올리지 않는다', async () => {
        const store = legacyStore();
        const pin = unstable_cache(async () => true, ['pin-order-a'], {
            revalidate: 60,
        });
        const long = unstable_cache(async () => true, ['pin-order-b'], {
            revalidate: 21600,
        });

        await runAsIsr(store, null, async () => {
            await long();
            await pin();
            await long();
        });

        expect(store.revalidate, HINT).toBe(60);
    });

    it('콜백이 던지면 stale 엔트리를 돌려준다(throw-inside / catch-outside 전제)', async () => {
        const store = legacyStore();
        const failing = unstable_cache(
            async (): Promise<string[]> => {
                throw new Error('db down');
            },
            ['stale-on-throw'],
            { revalidate: 21600 }
        );
        const stale: FakeEntry = {
            isStale: true,
            value: { kind: 'FETCH', data: { body: '["last-good"]' } },
        };

        const result = await runAsIsr(store, stale, () => failing());

        expect(result, HINT).toEqual(['last-good']);
    });

    it('콜백이 던지고 엔트리가 없으면 호출부로 throw가 전파된다', async () => {
        const store = legacyStore();
        const failing = unstable_cache(
            async (): Promise<string[]> => {
                throw new Error('db down');
            },
            ['throw-no-entry'],
            { revalidate: 21600 }
        );

        await expect(runAsIsr(store, null, () => failing())).rejects.toThrow(
            'db down'
        );
    });
});
