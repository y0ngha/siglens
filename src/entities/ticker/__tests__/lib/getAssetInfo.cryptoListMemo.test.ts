// 새 해석 순서에서는 크립토가 아닌 모든 호출이 asset_translations 조회 전에
// fmpCryptoMembership을 지난다. 이 순서가 호출마다 ~170KB Redis GET을 만들지 않는 건
// 목록의 인스턴스 메모리(L1) 캐시 덕분이므로, 실제 fmpCryptoMembership으로 그걸 고정한다.
// 목록 저장소(getOrSetCache)만 대역으로 두고, 키 단위로 호출 수를 센다.
const {
    getOrSetCacheMock,
    fetchCryptoAssetListMock,
    createCacheProviderMock,
    tryGetDatabaseClientMock,
    repositoryFactoryMock,
    mockRepository,
} = vi.hoisted(() => ({
    getOrSetCacheMock: vi.fn(),
    fetchCryptoAssetListMock: vi.fn(),
    createCacheProviderMock: vi.fn(),
    tryGetDatabaseClientMock: vi.fn(),
    repositoryFactoryMock: vi.fn(),
    mockRepository: { findBySymbol: vi.fn(), upsert: vi.fn() },
}));

vi.mock('server-only', () => ({}));
vi.mock('@/shared/cache/getOrSetCache', () => ({
    getOrSetCache: getOrSetCacheMock,
}));
vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    createCacheProvider: () => createCacheProviderMock(),
}));
vi.mock('@/shared/db/client', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/db/client')>()),
    tryGetDatabaseClient: () => tryGetDatabaseClientMock(),
}));
vi.mock('../../api', () => ({
    DrizzleAssetTranslationRepository: class {
        constructor(db: unknown) {
            return repositoryFactoryMock(db) as unknown as object;
        }
    },
    fetchCryptoAssetList: fetchCryptoAssetListMock,
}));
vi.mock('../../lib/cryptoAssetStore', () => ({
    getCryptoAsset: vi.fn().mockResolvedValue(null),
}));

import { CRYPTO_FMP_LIST_CACHE_KEY } from '../../lib/cacheKeys';
import { _resetFmpCryptoListMemoForTest } from '../../lib/fmpCryptoMembership';
import { getAssetInfo } from '../../lib/getAssetInfo';

describe('getAssetInfo — FMP 크립토 목록은 호출마다 Redis에서 받지 않는다', () => {
    beforeEach(() => {
        _resetFmpCryptoListMemoForTest();
        getOrSetCacheMock.mockReset();
        getOrSetCacheMock.mockResolvedValue({ BTCUSD: { name: 'Bitcoin' } });
        createCacheProviderMock.mockReset();
        createCacheProviderMock.mockReturnValue(null);
        tryGetDatabaseClientMock.mockReset();
        tryGetDatabaseClientMock.mockReturnValue({ db: {} });
        repositoryFactoryMock.mockReset();
        repositoryFactoryMock.mockReturnValue(mockRepository);
        mockRepository.findBySymbol.mockReset();
        mockRepository.findBySymbol.mockImplementation(
            async (symbol: string) => ({
                symbol,
                name: `${symbol} Inc.`,
                koreanName: `${symbol}-ko`,
                fmpSymbol: symbol,
            })
        );
    });

    it('번역된 주식(DB hit) 여러 개를 조회해도 crypto:fmp-list는 Redis에서 한 번만 읽는다', async () => {
        const symbols = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'GOOG'];

        const results = await Promise.all(symbols.map(s => getAssetInfo(s)));
        // 첫 묶음이 끝난 뒤의 순차 호출도 메모리에서 답해야 한다.
        for (const s of symbols) await getAssetInfo(s);

        expect(results.map(r => r?.koreanName)).toEqual(
            symbols.map(s => `${s}-ko`)
        );
        const listReads = getOrSetCacheMock.mock.calls.filter(
            ([key]) => key === CRYPTO_FMP_LIST_CACHE_KEY
        );
        expect(listReads).toHaveLength(1);
        expect(mockRepository.findBySymbol).toHaveBeenCalledTimes(
            symbols.length * 2
        );
    });
});
