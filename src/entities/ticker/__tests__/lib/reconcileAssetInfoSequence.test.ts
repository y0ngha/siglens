/**
 * cron(`reconcileUsTickerNames`) → `getAssetInfo` → cron 순서가 이름을 되돌려 쓰며 도는지(flap)
 * 확인하는 시뮬레이션.
 *
 * 걱정은 이것이다: cron은 `korean_tickers`/`asset_translations`에 **stock-list** 표기를
 * 쓰는데, `getAssetInfo`의 FMP 경로는 **search-symbol** 표기를 `reusableKoreanName`에서
 * 저장 이름과 비교한다. 두 표기가 정규화 후에도 다르면 getAssetInfo가 재번역해 search
 * 표기를 되써 넣고, 다음 cron이 다시 stock-list 표기로 갈아엎는 순환이 될 수 있다.
 *
 * 결론(이 파일이 고정하는 것): **순환하지 않는다.** FMP 경로는 `asset_translations` 행이
 * 없을 때만 타고(`resolveAssetInfo`는 DB를 먼저 읽는다), 그 경로가 끝나면 항상 그 행을 만든다.
 * 그래서 getAssetInfo의 FMP 경로는 심볼당 많아야 한 번이고, 그 뒤 cron은 한 번 더 갈아 쓴 다음
 * 수렴한다. 두 저장소와 두 표기를 실제 모듈로 엮어 날 단위로 돌린다.
 */
import type { AssetTranslationRecord } from '@/shared/db/types';
import type { KoreanTickerEntry } from '@/shared/lib/types';
import type { FmpSearchResult } from '../../model';

const {
    store,
    tryGetDatabaseClientMock,
    searchBySymbolMock,
    translateCompanyNamesMock,
    cronTranslateMock,
} = vi.hoisted(() => ({
    store: {
        tickers: new Map<string, unknown>(),
        assets: new Map<string, unknown>(),
    },
    tryGetDatabaseClientMock: vi.fn(),
    searchBySymbolMock: vi.fn(),
    translateCompanyNamesMock: vi.fn(),
    cronTranslateMock: vi.fn(),
}));

const tickers = store.tickers as Map<string, KoreanTickerEntry>;
const assets = store.assets as Map<string, AssetTranslationRecord>;

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    createCacheProvider: () => null,
}));
vi.mock('@/shared/db/client', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/db/client')>()),
    tryGetDatabaseClient: () => tryGetDatabaseClientMock(),
}));
vi.mock('../../api', () => ({
    DrizzleAssetTranslationRepository: class {
        findBySymbol = async (symbol: string) => assets.get(symbol) ?? null;
        upsert = async (record: AssetTranslationRecord) => {
            assets.set(record.symbol, record);
        };
    },
}));
vi.mock('../../lib/fmpTickerApi', async () => ({
    ...(await vi.importActual('../../lib/fmpTickerApi')),
    searchBySymbol: (q: string) => searchBySymbolMock(q),
}));
vi.mock('../../lib/koreanNameStore', () => ({
    getKoreanNames: async () => ({}),
    lookupTickerDisplayNames: async (symbols: string[]) =>
        Object.fromEntries(
            symbols.flatMap(s => {
                const row = tickers.get(s);
                return row
                    ? [[s, { koreanName: row.koreanName, name: row.name }]]
                    : [];
            })
        ),
    setKoreanTickers: async (entries: KoreanTickerEntry[]) => {
        entries.forEach(e => tickers.set(e.symbol, e));
    },
}));
vi.mock('../../lib/koreanTranslator', () => ({
    translateCompanyNames: (entries: unknown) =>
        translateCompanyNamesMock(entries),
}));
vi.mock('../../lib/krEquityQuoteName', () => ({
    fetchKrEquityQuoteName: vi.fn(),
}));
vi.mock('../../lib/cryptoAssetStore', () => ({
    getCryptoAsset: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../lib/fmpCryptoMembership', () => ({
    fmpCryptoMembership: vi.fn().mockResolvedValue(null),
}));

import {
    _resetInFlightTranslationsForTest,
    getAssetInfo,
} from '../../lib/getAssetInfo';
import { reconcileUsTickerNames } from '../../lib/reconcileUsTickerNames';

/** stock-list 표기와 search-symbol 표기 — 정규화 후에도 다른 (가상의) 불일치. */
const STOCK_LIST_NAME = 'Acme Global Technologies Inc';
const SEARCH_SYMBOL_NAME = 'Acme Worldwide Technologies Inc';

const searchHit: FmpSearchResult = {
    symbol: 'ACME',
    name: SEARCH_SYMBOL_NAME,
    currency: 'USD',
    exchange: 'NASDAQ',
    exchangeFullName: 'NASDAQ Global Select',
};

function tickerRow(name: string, koreanName: string): KoreanTickerEntry {
    return {
        symbol: 'ACME',
        name,
        koreanName,
        exchange: 'NASDAQ',
        exchangeFullName: 'NASDAQ Global Select',
    };
}

/** 하루치 cron — 저장소는 위 인메모리 store를 읽고 쓴다. */
function runCron() {
    return reconcileUsTickerNames({
        koreanTickerRepo: {
            findAllNonKr: async () => [...tickers.values()],
            upsertMany: async entries => {
                entries.forEach(e => tickers.set(e.symbol, { ...e }));
            },
        },
        assetTranslationRepo: {
            findAll: async () => [...assets.values()],
            upsert: async record => {
                assets.set(record.symbol, record);
            },
        },
        descriptionRepo: { deleteBySymbols: async () => {} },
        fetchStockList: async () => [
            { symbol: 'ACME', companyName: STOCK_LIST_NAME },
        ],
        translate: entries => cronTranslateMock(entries),
        revalidateSymbol: () => {},
        invalidateSearchSnapshot: async () => {},
    });
}

/** `fireAndForget`로 도는 번역·저장이 끝나도록 마이크로태스크를 비운다. */
async function flushBackground(): Promise<void> {
    for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setImmediate(resolve));
    }
}

beforeEach(() => {
    vi.clearAllMocks();
    _resetInFlightTranslationsForTest();
    tickers.clear();
    assets.clear();
    tryGetDatabaseClientMock.mockReturnValue({ db: {} });
    searchBySymbolMock.mockResolvedValue([searchHit]);
    translateCompanyNamesMock.mockResolvedValue({
        ACME: '애크미(getAssetInfo)',
    });
    cronTranslateMock.mockResolvedValue({ ACME: '애크미(cron)' });
});

describe('cron → getAssetInfo → cron 수렴', () => {
    it('asset_translations 행이 있으면 getAssetInfo는 FMP 경로를 타지 않아 cron 결과가 흔들리지 않는다', async () => {
        tickers.set('ACME', tickerRow('Old Name Corp', '옛이름'));
        assets.set('ACME', {
            symbol: 'ACME',
            name: 'Old Name Corp',
            koreanName: '옛이름',
            fmpSymbol: 'ACME',
        });

        const day1 = await runCron();
        const info = await getAssetInfo('ACME');
        await flushBackground();
        const day2 = await runCron();
        const day3 = await runCron();

        expect(day1.renamed).toBe(1);
        expect(info?.name).toBe(STOCK_LIST_NAME);
        expect(searchBySymbolMock).not.toHaveBeenCalled();
        expect(translateCompanyNamesMock).not.toHaveBeenCalled();
        expect(day2.renamed).toBe(0);
        expect(day3.renamed).toBe(0);
        expect(tickers.get('ACME')?.name).toBe(STOCK_LIST_NAME);
        expect(assets.get('ACME')?.name).toBe(STOCK_LIST_NAME);
    });

    it('asset_translations 행이 없을 때 FMP 경로가 search 표기를 써도 cron이 한 번 되돌린 뒤 다시는 흔들리지 않는다', async () => {
        // cron이 이미 stock-list 표기로 맞춰 둔 korean_tickers 행만 있다.
        tickers.set('ACME', tickerRow(STOCK_LIST_NAME, '애크미'));

        // getAssetInfo: 행이 없어 FMP 경로 → 표기 불일치로 재번역 → 두 테이블에 search 표기를 쓴다.
        await getAssetInfo('ACME');
        await flushBackground();
        expect(searchBySymbolMock).toHaveBeenCalledTimes(1);
        expect(translateCompanyNamesMock).toHaveBeenCalledTimes(1);
        expect(tickers.get('ACME')?.name).toBe(SEARCH_SYMBOL_NAME);
        expect(assets.get('ACME')?.name).toBe(SEARCH_SYMBOL_NAME);

        // 다음 cron이 stock-list 표기로 되돌린다(마지막 되돌림).
        const day1 = await runCron();
        expect(day1.renamed).toBe(1);
        expect(tickers.get('ACME')?.name).toBe(STOCK_LIST_NAME);
        expect(assets.get('ACME')?.name).toBe(STOCK_LIST_NAME);

        // 이후로는 asset_translations 행이 있어 FMP 경로가 막히고, cron도 후보가 없다.
        const searchCallsBefore = searchBySymbolMock.mock.calls.length;
        const translateCallsBefore =
            translateCompanyNamesMock.mock.calls.length;
        const cronTranslateCallsBefore = cronTranslateMock.mock.calls.length;
        for (let day = 0; day < 5; day++) {
            const info = await getAssetInfo('ACME');
            await flushBackground();
            const counts = await runCron();
            expect(info?.name).toBe(STOCK_LIST_NAME);
            expect(counts.renamed).toBe(0);
        }
        expect(searchBySymbolMock.mock.calls.length).toBe(searchCallsBefore);
        expect(translateCompanyNamesMock.mock.calls.length).toBe(
            translateCallsBefore
        );
        expect(cronTranslateMock.mock.calls.length).toBe(
            cronTranslateCallsBefore
        );
    });
});
