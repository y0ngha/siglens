import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    CRYPTO_SESSION,
    US_EQUITY_SESSION,
    type Bar,
    type MarketDataProvider,
} from '@y0ngha/siglens-core';

const { mockIsE2E, fakeRawProvider, ctorCalls } = vi.hoisted(() => ({
    ctorCalls: [] as unknown[][],
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

// 생성자 인자를 기록하기 위한 얇은 서브클래스. `session`이 private이라 밖에서 못
// 읽는데, 이 인자야말로 시장별 TTL·EOD 꼬리를 결정하는 값이라 배선을 고정해야 한다.
// `instanceof` 단언은 서브클래스 인스턴스도 참이므로 기존 테스트와 공존한다.
vi.mock('@/shared/api/market/CachedMarketDataProvider', async orig => {
    const actual =
        await orig<
            typeof import('@/shared/api/market/CachedMarketDataProvider')
        >();
    return {
        ...actual,
        CachedMarketDataProvider: class
            extends actual.CachedMarketDataProvider
        {
            constructor(
                ...args: ConstructorParameters<
                    typeof actual.CachedMarketDataProvider
                >
            ) {
                ctorCalls.push(args);
                super(...args);
            }
        },
    };
});

describe('getCachedMarketDataProvider', () => {
    beforeEach(() => {
        vi.resetModules();
        mockIsE2E.mockReturnValue(false);
        ctorCalls.length = 0;
    });

    it('같은 인스턴스를 반환한다(singleton)', async () => {
        const { getCachedMarketDataProvider } =
            await import('@/shared/api/market/getCachedMarketDataProvider');
        expect(getCachedMarketDataProvider(US_EQUITY_SESSION)).toBe(
            getCachedMarketDataProvider(US_EQUITY_SESSION)
        );
    });

    it('비-E2E면 CachedMarketDataProvider를 반환한다', async () => {
        mockIsE2E.mockReturnValue(false);
        const { getCachedMarketDataProvider } =
            await import('@/shared/api/market/getCachedMarketDataProvider');
        const { CachedMarketDataProvider } =
            await import('@/shared/api/market/CachedMarketDataProvider');
        expect(getCachedMarketDataProvider(US_EQUITY_SESSION)).toBeInstanceOf(
            CachedMarketDataProvider
        );
    });

    it('E2E면 raw provider(getMarketDataProvider)와 동일 인스턴스를 반환한다(Fake)', async () => {
        mockIsE2E.mockReturnValue(true);
        const { getCachedMarketDataProvider } =
            await import('@/shared/api/market/getCachedMarketDataProvider');
        const { getMarketDataProvider } =
            await import('@/shared/api/market/getMarketDataProvider');
        expect(getCachedMarketDataProvider(US_EQUITY_SESSION)).toBe(
            getMarketDataProvider()
        );
    });

    it('CRYPTO_SESSION — cachedCrypto 싱글톤을 반복 호출에 재사용한다', async () => {
        const { getCachedMarketDataProvider } =
            await import('@/shared/api/market/getCachedMarketDataProvider');
        const first = getCachedMarketDataProvider(CRYPTO_SESSION);
        const second = getCachedMarketDataProvider(CRYPTO_SESSION);
        expect(first).toBe(second);
    });

    it('US_EQUITY_SESSION — equity 싱글톤을 반복 호출에 재사용한다', async () => {
        const { getCachedMarketDataProvider } =
            await import('@/shared/api/market/getCachedMarketDataProvider');
        const first = getCachedMarketDataProvider(US_EQUITY_SESSION);
        const second = getCachedMarketDataProvider(US_EQUITY_SESSION);
        expect(first).toBe(second);
    });

    it('CRYPTO_SESSION과 US_EQUITY_SESSION은 서로 다른 인스턴스다', async () => {
        const { getCachedMarketDataProvider } =
            await import('@/shared/api/market/getCachedMarketDataProvider');
        const crypto = getCachedMarketDataProvider(CRYPTO_SESSION);
        const equity = getCachedMarketDataProvider(US_EQUITY_SESSION);
        expect(crypto).not.toBe(equity);
    });

    it('KR_EQUITY_SESSION — kr 싱글톤을 반복 호출에 재사용한다', async () => {
        const { getCachedMarketDataProvider } =
            await import('@/shared/api/market/getCachedMarketDataProvider');
        const { KR_EQUITY_SESSION } =
            await import('@/shared/api/market/sessionSpecFor');
        expect(getCachedMarketDataProvider(KR_EQUITY_SESSION)).toBe(
            getCachedMarketDataProvider(KR_EQUITY_SESSION)
        );
    });

    it('KR_EQUITY_SESSION은 us/crypto와 다른 인스턴스다', async () => {
        // 크립토는 세션만 바꿔 같은 FmpMarketProvider를 감싸지만, 한국은 provider
        // 자체가 yahoo라 분기가 반드시 갈려야 한다.
        const { getCachedMarketDataProvider } =
            await import('@/shared/api/market/getCachedMarketDataProvider');
        const { KR_EQUITY_SESSION } =
            await import('@/shared/api/market/sessionSpecFor');
        const kr = getCachedMarketDataProvider(KR_EQUITY_SESSION);
        expect(kr).not.toBe(getCachedMarketDataProvider(US_EQUITY_SESSION));
        expect(kr).not.toBe(getCachedMarketDataProvider(CRYPTO_SESSION));
    });

    it('KR_EQUITY_SESSION도 비-E2E면 CachedMarketDataProvider로 감싼다', async () => {
        const { getCachedMarketDataProvider } =
            await import('@/shared/api/market/getCachedMarketDataProvider');
        const { CachedMarketDataProvider } =
            await import('@/shared/api/market/CachedMarketDataProvider');
        const { KR_EQUITY_SESSION } =
            await import('@/shared/api/market/sessionSpecFor');
        expect(getCachedMarketDataProvider(KR_EQUITY_SESSION)).toBeInstanceOf(
            CachedMarketDataProvider
        );
    });

    /**
     * [회귀] 어느 세션 스펙이 넘어가는지는 어떤 테스트도 안 잡고 있었다 —
     * KR 분기에 `US_EQUITY_SESSION`을 넣어도 이 디렉터리 70건이 전부 통과했다
     * (감사 라운드 12). 기존 단언은 싱글톤 동일성과 `instanceof`뿐이다.
     *
     * `session`은 `computeBarsEffectiveTtl`과 `lastClosedSessionDate`(EOD 꼬리)에
     * 쓰인다. 미국 스펙이 들어가면 KST 낮 시간대에 이미 닫힌 KRX를 열려 있다고
     * 보고, 차트와 technical/overall AI 프롬프트가 잘못된 마지막 일봉을 받는다.
     */
    it('시장별로 자기 세션 스펙을 생성자에 넘긴다', async () => {
        const { getCachedMarketDataProvider } =
            await import('@/shared/api/market/getCachedMarketDataProvider');
        const { KR_EQUITY_SESSION } =
            await import('@/shared/api/market/sessionSpecFor');

        getCachedMarketDataProvider(KR_EQUITY_SESSION);
        expect(ctorCalls.at(-1)?.[1]).toBe(KR_EQUITY_SESSION);

        getCachedMarketDataProvider(CRYPTO_SESSION);
        expect(ctorCalls.at(-1)?.[1]).toBe(CRYPTO_SESSION);
    });

    it('E2E면 KR_EQUITY_SESSION도 raw provider를 반환한다(네트워크 차단)', async () => {
        mockIsE2E.mockReturnValue(true);
        const { getCachedMarketDataProvider } =
            await import('@/shared/api/market/getCachedMarketDataProvider');
        const { getMarketDataProvider } =
            await import('@/shared/api/market/getMarketDataProvider');
        const { KR_EQUITY_SESSION } =
            await import('@/shared/api/market/sessionSpecFor');
        expect(getCachedMarketDataProvider(KR_EQUITY_SESSION)).toBe(
            getMarketDataProvider()
        );
    });
});
