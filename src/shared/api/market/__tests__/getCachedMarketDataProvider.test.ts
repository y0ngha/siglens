import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bar, MarketDataProvider } from '@y0ngha/siglens-core';

const { mockIsE2E, fakeRawProvider } = vi.hoisted(() => ({
    mockIsE2E: vi.fn(() => false),
    fakeRawProvider: {
        getBars: vi.fn(async () => [] as Bar[]),
        getQuote: vi.fn(async () => null),
    } as MarketDataProvider,
}));
vi.mock('@/shared/api/e2eEnv', () => ({ isE2E: mockIsE2E }));

// getMarketDataProvider는 isE2E()=true 시 require('./FakeMarketProvider')를 CJS로
// 직접 호출한다. vmThreads VM 컨텍스트에서 CJS require가 .ts 확장자를 해석하지
// 못해 "Cannot find module" 에러가 난다. 팩토리 동작을 단위-테스트하는 데
// 내부 구현(FakeMarketProvider require)은 필요 없으므로 getMarketDataProvider 자체를
// stub해 raw provider 객체만 돌려준다 — 테스트 목적(getCachedMarketDataProvider가
// isE2E=true 시 같은 인스턴스를 반환하는 것)에 충분하다.
vi.mock('@/shared/api/market/getMarketDataProvider', () => ({
    getMarketDataProvider: () => fakeRawProvider,
}));

describe('getCachedMarketDataProvider', () => {
    beforeEach(() => {
        vi.resetModules();
        mockIsE2E.mockReturnValue(false);
    });

    it('같은 인스턴스를 반환한다(singleton)', async () => {
        const { getCachedMarketDataProvider } =
            await import('@/shared/api/market/getCachedMarketDataProvider');
        expect(getCachedMarketDataProvider()).toBe(
            getCachedMarketDataProvider()
        );
    });

    it('비-E2E면 CachedMarketDataProvider를 반환한다', async () => {
        mockIsE2E.mockReturnValue(false);
        const { getCachedMarketDataProvider } =
            await import('@/shared/api/market/getCachedMarketDataProvider');
        const { CachedMarketDataProvider } =
            await import('@/shared/api/market/CachedMarketDataProvider');
        expect(getCachedMarketDataProvider()).toBeInstanceOf(
            CachedMarketDataProvider
        );
    });

    it('E2E면 raw provider(getMarketDataProvider)와 동일 인스턴스를 반환한다(Fake)', async () => {
        mockIsE2E.mockReturnValue(true);
        const { getCachedMarketDataProvider } =
            await import('@/shared/api/market/getCachedMarketDataProvider');
        const { getMarketDataProvider } =
            await import('@/shared/api/market/getMarketDataProvider');
        expect(getCachedMarketDataProvider()).toBe(getMarketDataProvider());
    });

    it('getCachedMarketDataProvider(true) — cachedCrypto 싱글톤을 반복 호출에 재사용한다', async () => {
        const { getCachedMarketDataProvider } =
            await import('@/shared/api/market/getCachedMarketDataProvider');
        const first = getCachedMarketDataProvider(true);
        const second = getCachedMarketDataProvider(true);
        expect(first).toBe(second);
    });

    it('getCachedMarketDataProvider(false) — equity 싱글톤을 반복 호출에 재사용한다', async () => {
        const { getCachedMarketDataProvider } =
            await import('@/shared/api/market/getCachedMarketDataProvider');
        const first = getCachedMarketDataProvider(false);
        const second = getCachedMarketDataProvider(false);
        expect(first).toBe(second);
    });

    it('getCachedMarketDataProvider(true)와 getCachedMarketDataProvider(false)는 서로 다른 인스턴스다', async () => {
        const { getCachedMarketDataProvider } =
            await import('@/shared/api/market/getCachedMarketDataProvider');
        const crypto = getCachedMarketDataProvider(true);
        const equity = getCachedMarketDataProvider(false);
        expect(crypto).not.toBe(equity);
    });
});
