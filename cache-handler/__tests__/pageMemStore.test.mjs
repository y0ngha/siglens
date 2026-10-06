import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    approximateBytes,
    getEntry,
    setEntry,
    deleteEntry,
    statsForTest,
    __resetForTests,
} from '../pageMemStore.mjs';

function page(html, extra = {}) {
    return {
        value: { kind: 'APP_PAGE', html, ...extra },
        lastModified: 1,
        tags: [],
    };
}

/** 상한·TTL이 모듈 로드 시점 상수라 env를 바꾼 뒤 다시 임포트한다. */
async function freshStore(env) {
    vi.resetModules();
    Object.entries(env).forEach(([name, value]) => vi.stubEnv(name, value));
    return import('../pageMemStore.mjs');
}

beforeEach(() => {
    __resetForTests();
    vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.restoreAllMocks();
});

describe('approximateBytes', () => {
    it('APP_PAGE의 html·rscData·postponed·segmentData를 합산한다', () => {
        const bytes = approximateBytes({
            kind: 'APP_PAGE',
            html: 'x'.repeat(10),
            rscData: Buffer.alloc(20),
            postponed: 'p'.repeat(5),
            segmentData: new Map([
                ['/a', Buffer.alloc(3)],
                ['/b', Buffer.alloc(4)],
            ]),
        });
        expect(bytes).toBe(42);
    });

    it('APP_ROUTE는 body를 센다', () => {
        expect(
            approximateBytes({ kind: 'APP_ROUTE', body: Buffer.alloc(64) })
        ).toBe(64);
    });

    it('PAGES의 pageData는 고정 추정치로 센다', () => {
        expect(
            approximateBytes({ kind: 'PAGES', html: 'ab', pageData: {} })
        ).toBe(1026);
    });

    it('값이 없으면 1KB로 본다', () => {
        expect(approximateBytes(undefined)).toBe(1024);
    });
});

describe('pageMemStore', () => {
    it('set한 엔트리를 get으로 돌려주고 hit/miss를 센다', () => {
        const entry = page('hi');
        expect(setEntry('/AAPL', entry)).toBe(true);
        expect(getEntry('/AAPL')).toBe(entry);
        expect(getEntry('/MSFT')).toBeNull();
        expect(statsForTest()).toMatchObject({ size: 1, hits: 1, misses: 1 });
    });

    it('deleteEntry로 지운다', () => {
        setEntry('/AAPL', page('hi'));
        deleteEntry('/AAPL');
        expect(getEntry('/AAPL')).toBeNull();
    });

    it('킬 스위치면 get은 miss, set은 거부한다', () => {
        vi.stubEnv('ISR_PAGE_CACHE_DISABLED', 'true');
        expect(setEntry('/AAPL', page('hi'))).toBe(false);
        expect(getEntry('/AAPL')).toBeNull();
    });

    it('첫 접근에서 page-mem 상태 로그를 JSON 한 줄로 남긴다', () => {
        getEntry('/AAPL');
        const line = console.log.mock.calls
            .map(([arg]) => arg)
            .find(arg => typeof arg === 'string' && arg.includes('page-mem'));
        expect(JSON.parse(line)).toMatchObject({
            tag: 'isr-cache',
            event: 'page-mem',
        });
    });

    it('TTL(env)이 지나면 S3로 다시 가도록 miss가 된다', async () => {
        vi.useFakeTimers();
        const store = await freshStore({ ISR_PAGE_CACHE_TTL_MS: '1000' });
        store.setEntry('/AAPL', page('hi'));
        vi.advanceTimersByTime(999);
        expect(store.getEntry('/AAPL')).not.toBeNull();
        vi.advanceTimersByTime(1);
        expect(store.getEntry('/AAPL')).toBeNull();
    });

    it('TTL env는 60초로 상한이 걸린다', async () => {
        vi.useFakeTimers();
        const store = await freshStore({ ISR_PAGE_CACHE_TTL_MS: '600000' });
        store.setEntry('/AAPL', page('hi'));
        vi.advanceTimersByTime(60_000);
        expect(store.getEntry('/AAPL')).toBeNull();
    });

    it('바이트 예산(env)을 넘으면 오래된 페이지부터 축출하고, 예산보다 큰 페이지는 거부한다', async () => {
        const store = await freshStore({ ISR_PAGE_CACHE_MAX_BYTES: '100' });
        store.setEntry('/A', page('a'.repeat(60)));
        store.setEntry('/B', page('b'.repeat(60)));
        expect(store.getEntry('/A')).toBeNull();
        expect(store.getEntry('/B')).not.toBeNull();
        expect(store.setEntry('/C', page('c'.repeat(101)))).toBe(false);
    });
});
