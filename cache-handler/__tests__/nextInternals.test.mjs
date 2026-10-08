import { describe, it, expect, afterEach, vi } from 'vitest';

afterEach(() => {
    vi.doUnmock('node:module');
    vi.resetModules();
    vi.restoreAllMocks();
});

describe('Next 모듈을 못 읽는 환경', () => {
    async function loadWithoutNext() {
        vi.resetModules();
        vi.doMock('node:module', () => ({
            createRequire: () => () => {
                throw new Error('Cannot find module next');
            },
        }));
        vi.spyOn(console, 'error').mockImplementation(() => {});
        return import('../nextInternals.mjs');
    }

    it('시드는 건너뛰고 [isr-cache] error를 한 번만 남긴다', async () => {
        const internals = await loadWithoutNext();
        expect(() =>
            internals.seedCacheControl('/AAPL', { revalidate: 60 })
        ).not.toThrow();
        internals.seedCacheControl('/MSFT', { revalidate: 60 });
        expect(console.error).toHaveBeenCalledTimes(1);
        expect(console.error.mock.calls[0][0]).toMatch(
            /^\[isr-cache\] SharedCacheControls unavailable/
        );
    });

    it('정적 Map 모양이 바뀐 Next도 시드를 끄고 error로 알린다', async () => {
        vi.resetModules();
        vi.doMock('node:module', () => ({
            createRequire: () => () => ({
                SharedCacheControls: { cacheControls: undefined },
            }),
        }));
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const internals = await import('../nextInternals.mjs');
        expect(() =>
            internals.seedCacheControl('/AAPL', { revalidate: 60 })
        ).not.toThrow();
        expect(console.error.mock.calls[0][0]).toMatch(
            /^\[isr-cache\] SharedCacheControls unavailable/
        );
    });

    it('stale 판정은 엔트리에 영속한 cacheControl로 계속 동작한다', async () => {
        const internals = await loadWithoutNext();
        const now = 1_000_000_000_000;
        expect(
            internals.staleLastModified({
                cacheKey: '/AAPL',
                kind: 'APP_PAGE',
                entry: {
                    lastModified: now,
                    cacheControl: { revalidate: 60, expire: 3600 },
                },
                ctx: {},
                now,
            })
        ).toBe(now - 60_000 - 1_000);
    });
});

describe('staleLastModified — 실제 lastModified보다 새로워지지 않는다', () => {
    const now = 1_000_000_000_000;

    it('이미 시간상 stale인 페이지는 원래 lastModified를 유지한다', async () => {
        const { staleLastModified } = await import('../nextInternals.mjs');
        const old = now - 2 * 3600 * 1000;
        expect(
            staleLastModified({
                cacheKey: '/OLD-ONLY-ROUTE',
                kind: 'APP_PAGE',
                entry: {
                    lastModified: old,
                    cacheControl: { revalidate: 3600, expire: 31536000 },
                },
                ctx: {},
                now,
            })
        ).toBe(old);
    });

    it('expire를 이미 넘긴 페이지는 태그 stale이어도 null(블로킹) — 시간 기반 expire 유지', async () => {
        const { staleLastModified } = await import('../nextInternals.mjs');
        expect(
            staleLastModified({
                cacheKey: '/EXPIRED-ONLY-ROUTE',
                kind: 'APP_PAGE',
                entry: {
                    lastModified: now - 10_000 * 1000,
                    cacheControl: { revalidate: 60, expire: 3600 },
                },
                ctx: {},
                now,
            })
        ).toBeNull();
    });

    it('FETCH도 원래 lastModified보다 새로워지지 않는다', async () => {
        const { staleLastModified } = await import('../nextInternals.mjs');
        const old = now - 7200 * 1000;
        expect(
            staleLastModified({
                cacheKey: 'k',
                kind: 'FETCH',
                entry: { lastModified: old, value: { revalidate: 600 } },
                ctx: {},
                now,
            })
        ).toBe(old);
    });
});
