const {
    mockFmpGet,
    mockTryGetClient,
    mockTranslate,
    mockRevalidateTag,
    mockInvalidate,
    mockTickerRepo,
    mockAssetRepo,
    mockDescriptionRepo,
    events,
} = vi.hoisted(() => ({
    mockFmpGet: vi.fn(),
    mockTryGetClient: vi.fn(),
    mockTranslate: vi.fn(),
    mockRevalidateTag: vi.fn(),
    mockInvalidate: vi.fn(),
    mockTickerRepo: {
        findAllNonKr: vi.fn(),
        upsertMany: vi.fn(),
    },
    mockAssetRepo: {
        findAll: vi.fn(),
        upsert: vi.fn(),
    },
    mockDescriptionRepo: {
        deleteBySymbols: vi.fn(),
    },
    /** 쓰기 호출의 상대 순서를 기록한다 — 호출 인덱스에 기대지 않고 이름으로 비교한다. */
    events: [] as string[],
}));

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidateTag: mockRevalidateTag }));
vi.mock('@/shared/api/fmp/httpClient', () => ({ fmpGet: mockFmpGet }));
vi.mock('@/shared/db/client', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/db/client')>()),
    tryGetDatabaseClient: mockTryGetClient,
}));
vi.mock('../../lib/koreanNameStore', () => ({
    invalidateKoreanTickerCache: mockInvalidate,
}));
vi.mock('../../lib/koreanTranslator', () => ({
    translateCompanyNames: mockTranslate,
}));
vi.mock('../../api', () => ({
    DrizzleKoreanTickerRepository: class {
        findAllNonKr = mockTickerRepo.findAllNonKr;
        upsertMany = mockTickerRepo.upsertMany;
    },
    DrizzleAssetTranslationRepository: class {
        findAll = mockAssetRepo.findAll;
        upsert = mockAssetRepo.upsert;
    },
    DrizzleProfileDescriptionTranslationRepository: class {
        deleteBySymbols = mockDescriptionRepo.deleteBySymbols;
    },
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { KoreanTickerEntry } from '@/shared/lib/types';
import { reconcileUsTickerNames } from '../../lib/reconcileUsTickerNames';
import {
    RENAME_BATCH_MAX,
    RENAME_GUARD_MAX,
} from '../../lib/tickerNameReconcile';

function tickerRow(
    symbol: string,
    name: string,
    koreanName = '옛이름'
): KoreanTickerEntry {
    return {
        symbol,
        name,
        koreanName,
        exchange: 'NASDAQ',
        exchangeFullName: 'NASDAQ Global Select',
    };
}

function assetRow(symbol: string, name: string, koreanName = '옛이름') {
    return { symbol, name, koreanName, fmpSymbol: symbol };
}

function loggedLines(spy: { mock: { calls: unknown[][] } }): string[] {
    return spy.mock.calls.map(call => String(call[0]));
}

describe('reconcileUsTickerNames', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        events.length = 0;
        mockTryGetClient.mockReturnValue({ db: {} });
        mockFmpGet.mockResolvedValue([
            { symbol: 'LAZR', companyName: 'Luminar Technologies' },
            { symbol: 'AAPL', companyName: 'Apple Inc.' },
        ]);
        mockTickerRepo.findAllNonKr.mockResolvedValue([
            tickerRow('LAZR', 'Old Lidar Corp'),
            tickerRow('AAPL', 'Apple Inc', '애플'),
        ]);
        mockAssetRepo.findAll.mockResolvedValue([
            assetRow('LAZR', 'Old Lidar Corp'),
        ]);
        mockTranslate.mockImplementation(
            async (entries: { symbol: string }[]) => {
                events.push('translate');
                return Object.fromEntries(
                    entries.map(e => [e.symbol, '루미나'])
                );
            }
        );
        mockTickerRepo.upsertMany.mockImplementation(async () => {
            events.push('upsert:korean_tickers');
        });
        mockAssetRepo.upsert.mockImplementation(async () => {
            events.push('upsert:asset_translations');
        });
        mockDescriptionRepo.deleteBySymbols.mockImplementation(async () => {
            events.push('delete:description');
        });
        mockRevalidateTag.mockImplementation(() => {
            events.push('revalidate');
        });
        mockInvalidate.mockImplementation(async () => {
            events.push('invalidate:snapshot');
        });
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('stock-list는 FMP에서 한 번만 받는다', async () => {
        await reconcileUsTickerNames();

        expect(mockFmpGet).toHaveBeenCalledTimes(1);
        expect(mockFmpGet.mock.calls[0][0]).toBe('stock-list');
    });

    it('번역 → 설명 삭제 → 두 테이블 upsert → revalidateTag → 검색 스냅샷 무효화 순서로 처리한다', async () => {
        const counts = await reconcileUsTickerNames();

        expect(events).toEqual([
            'translate',
            'delete:description',
            'upsert:korean_tickers',
            'upsert:asset_translations',
            'revalidate',
            'invalidate:snapshot',
        ]);
        expect(counts).toEqual({
            listed: 2,
            compared: 2,
            renamed: 1,
            failed: 0,
            deferred: 0,
            guardTrip: null,
        });
    });

    it('korean_tickers는 exchange를 유지한 채 name·koreanName만 갈아 쓴다', async () => {
        await reconcileUsTickerNames();

        expect(mockTickerRepo.upsertMany).toHaveBeenCalledWith([
            {
                symbol: 'LAZR',
                name: 'Luminar Technologies',
                koreanName: '루미나',
                exchange: 'NASDAQ',
                exchangeFullName: 'NASDAQ Global Select',
            },
        ]);
    });

    it('asset_translations는 fmpSymbol을 유지한 채 갈아 쓴다', async () => {
        await reconcileUsTickerNames();

        expect(mockAssetRepo.upsert).toHaveBeenCalledWith({
            symbol: 'LAZR',
            name: 'Luminar Technologies',
            koreanName: '루미나',
            fmpSymbol: 'LAZR',
        });
    });

    it('asset_translations에 행이 없으면 만들지 않는다', async () => {
        mockAssetRepo.findAll.mockResolvedValue([]);

        await reconcileUsTickerNames();

        expect(mockAssetRepo.upsert).not.toHaveBeenCalled();
        expect(mockTickerRepo.upsertMany).toHaveBeenCalledTimes(1);
    });

    it('korean_tickers에 행이 없으면 거래소를 지어내지 않고 건너뛴다', async () => {
        mockTickerRepo.findAllNonKr.mockResolvedValue([]);

        await reconcileUsTickerNames();

        expect(mockTickerRepo.upsertMany).not.toHaveBeenCalled();
        expect(mockAssetRepo.upsert).toHaveBeenCalledTimes(1);
    });

    it('fmpSymbol이 심볼과 다른 asset_translations 행(지수 등)은 대조하지 않는다', async () => {
        mockTickerRepo.findAllNonKr.mockResolvedValue([]);
        mockAssetRepo.findAll.mockResolvedValue([
            { ...assetRow('LAZR', 'Old Lidar Corp'), fmpSymbol: 'LAZR.MX' },
        ]);

        const counts = await reconcileUsTickerNames();

        expect(counts.renamed).toBe(0);
        expect(mockTranslate).not.toHaveBeenCalled();
    });

    it('upsert가 던져도 설명 삭제는 이미 끝났고 그 심볼은 태그를 무효화하지 않는다', async () => {
        mockTickerRepo.upsertMany.mockRejectedValue(new Error('db down'));

        const counts = await reconcileUsTickerNames();

        expect(events).toContain('delete:description');
        expect(events).not.toContain('revalidate');
        expect(mockRevalidateTag).not.toHaveBeenCalled();
        expect(counts.renamed).toBe(0);
        expect(counts.failed).toBe(1);
        // 쓰기가 하나도 성공하지 않았으므로 스냅샷도 건드리지 않는다.
        expect(mockInvalidate).not.toHaveBeenCalled();
    });

    it('한 심볼의 쓰기 실패는 나머지를 막지 않고, 성공한 심볼만 태그를 무효화한다', async () => {
        mockFmpGet.mockResolvedValue([
            { symbol: 'BAD', companyName: 'Bad New Corp' },
            { symbol: 'LAZR', companyName: 'Luminar Technologies' },
        ]);
        mockTickerRepo.findAllNonKr.mockResolvedValue([
            tickerRow('BAD', 'Bad Old Industries'),
            tickerRow('LAZR', 'Old Lidar Corp'),
        ]);
        mockAssetRepo.findAll.mockResolvedValue([]);
        mockTickerRepo.upsertMany.mockImplementation(
            async (entries: KoreanTickerEntry[]) => {
                if (entries.some(e => e.symbol === 'BAD')) {
                    throw new Error('constraint');
                }
            }
        );

        const counts = await reconcileUsTickerNames();

        expect(counts.renamed).toBe(1);
        expect(counts.failed).toBe(1);
        expect(mockRevalidateTag).toHaveBeenCalledTimes(1);
        expect(mockRevalidateTag).toHaveBeenCalledWith('symbol:LAZR', 'max');
        expect(mockInvalidate).toHaveBeenCalledTimes(1);
    });

    it('asset_translations 쓰기가 실패하면 그 심볼은 태그를 무효화하지 않는다', async () => {
        mockAssetRepo.upsert.mockRejectedValue(new Error('db down'));

        const counts = await reconcileUsTickerNames();

        expect(counts.failed).toBe(1);
        expect(mockRevalidateTag).not.toHaveBeenCalled();
    });

    it('dual-class asset_translations 행(BRK.B, fmpSymbol BRK-B)도 대조하고 갈아 쓴다', async () => {
        mockFmpGet.mockResolvedValue([
            { symbol: 'BRK-B', companyName: 'Berkshire Reborn' },
        ]);
        mockTickerRepo.findAllNonKr.mockResolvedValue([]);
        mockAssetRepo.findAll.mockResolvedValue([
            {
                symbol: 'BRK.B',
                name: 'Berkshire Hathaway Old',
                koreanName: '옛이름',
                fmpSymbol: 'BRK-B',
            },
        ]);

        const counts = await reconcileUsTickerNames();

        expect(counts.compared).toBe(1);
        expect(counts.renamed).toBe(1);
        expect(mockAssetRepo.upsert).toHaveBeenCalledWith({
            symbol: 'BRK.B',
            name: 'Berkshire Reborn',
            koreanName: '루미나',
            fmpSymbol: 'BRK-B',
        });
        expect(mockRevalidateTag).toHaveBeenCalledWith('symbol:BRK.B', 'max');
    });

    it('별칭 맵에 없는 dual-class korean_tickers 심볼(HEI.A)도 하이픈 표기로 대조한다', async () => {
        mockFmpGet.mockResolvedValue([
            { symbol: 'HEI-A', companyName: 'HEICO Reborn' },
        ]);
        mockTickerRepo.findAllNonKr.mockResolvedValue([
            tickerRow('HEI.A', 'HEICO Old Industries'),
        ]);
        mockAssetRepo.findAll.mockResolvedValue([]);

        const counts = await reconcileUsTickerNames();

        expect(counts.compared).toBe(1);
        expect(counts.renamed).toBe(1);
    });

    it('회사 설명 번역을 지우고 symbol 태그를 무효화한다', async () => {
        await reconcileUsTickerNames();

        expect(mockDescriptionRepo.deleteBySymbols).toHaveBeenCalledWith([
            'LAZR',
        ]);
        expect(mockRevalidateTag).toHaveBeenCalledTimes(1);
        expect(mockRevalidateTag).toHaveBeenCalledWith('symbol:LAZR', 'max');
    });

    it('변경 로그를 정해진 형식으로 남긴다', async () => {
        const logSpy = vi.mocked(console.log);

        await reconcileUsTickerNames();

        expect(loggedLines(logSpy)).toContain(
            '[ticker-names] renamed LAZR: "Old Lidar Corp" → "Luminar Technologies" (한글: 옛이름 → 루미나)'
        );
    });

    it('번역에 실패한 심볼은 아무것도 쓰지 않는다', async () => {
        mockTranslate.mockResolvedValue({});

        const counts = await reconcileUsTickerNames();

        expect(counts.renamed).toBe(0);
        expect(mockTickerRepo.upsertMany).not.toHaveBeenCalled();
        expect(mockAssetRepo.upsert).not.toHaveBeenCalled();
        expect(mockDescriptionRepo.deleteBySymbols).not.toHaveBeenCalled();
        expect(mockRevalidateTag).not.toHaveBeenCalled();
    });

    it('일부만 번역되면 번역된 심볼만 쓴다', async () => {
        mockFmpGet.mockResolvedValue([
            { symbol: 'LAZR', companyName: 'Luminar Technologies' },
            { symbol: 'NEWC', companyName: 'Newco Corp' },
        ]);
        mockTickerRepo.findAllNonKr.mockResolvedValue([
            tickerRow('LAZR', 'Old Lidar Corp'),
            tickerRow('NEWC', 'Oldco Corp'),
        ]);
        mockAssetRepo.findAll.mockResolvedValue([]);
        mockTranslate.mockResolvedValue({ NEWC: '뉴코' });

        const counts = await reconcileUsTickerNames();

        expect(counts.renamed).toBe(1);
        const written = mockTickerRepo.upsertMany.mock.calls.flatMap(
            call => call[0] as KoreanTickerEntry[]
        );
        expect(written.map(e => e.symbol)).toEqual(['NEWC']);
        expect(mockRevalidateTag).toHaveBeenCalledWith('symbol:NEWC', 'max');
        expect(mockRevalidateTag).not.toHaveBeenCalledWith(
            'symbol:LAZR',
            'max'
        );
    });

    it('정본 심볼은 쓰지 않고 검토 로그만 남긴다', async () => {
        mockFmpGet.mockResolvedValue([
            { symbol: 'LAES', companyName: 'Reassigned Co' },
        ]);
        mockTickerRepo.findAllNonKr.mockResolvedValue([
            tickerRow('LAES', 'SEALSQ Corp', '실스큐'),
        ]);
        mockAssetRepo.findAll.mockResolvedValue([]);
        const warnSpy = vi.mocked(console.warn);

        const counts = await reconcileUsTickerNames();

        expect(counts.renamed).toBe(0);
        expect(mockTranslate).not.toHaveBeenCalled();
        expect(mockTickerRepo.upsertMany).not.toHaveBeenCalled();
        expect(mockRevalidateTag).not.toHaveBeenCalled();
        expect(loggedLines(warnSpy)).toContain(
            '[ticker-names] canonical symbol renamed — review: LAES SEALSQ Corp→Reassigned Co'
        );
    });

    it('후보가 가드 상한을 넘으면 아무것도 쓰지 않고 skipped 로그를 남긴다', async () => {
        const count = RENAME_GUARD_MAX + 1;
        const symbols = Array.from({ length: count }, (_, i) => `S${i}`);
        mockFmpGet.mockResolvedValue(
            symbols.map(symbol => ({ symbol, companyName: `New ${symbol}` }))
        );
        mockTickerRepo.findAllNonKr.mockResolvedValue(
            symbols.map(symbol => tickerRow(symbol, `Old ${symbol} Industries`))
        );
        mockAssetRepo.findAll.mockResolvedValue([]);
        const errorSpy = vi.mocked(console.error);

        const counts = await reconcileUsTickerNames();

        expect(counts.guardTrip).toBe(`${count} candidates`);
        expect(counts.renamed).toBe(0);
        expect(mockTranslate).not.toHaveBeenCalled();
        expect(mockTickerRepo.upsertMany).not.toHaveBeenCalled();
        expect(mockRevalidateTag).not.toHaveBeenCalled();
        expect(loggedLines(errorSpy)).toContain(
            `[ticker-names] reconcile skipped — ${count} candidates`
        );
    });

    it('배치 상한을 넘는 후보는 deferred로 이월하고 상한만큼만 번역한다', async () => {
        const count = RENAME_BATCH_MAX + 3;
        const symbols = Array.from({ length: count }, (_, i) => `S${i}`);
        mockFmpGet.mockResolvedValue(
            symbols.map(symbol => ({ symbol, companyName: `New ${symbol}` }))
        );
        mockTickerRepo.findAllNonKr.mockResolvedValue(
            symbols.map(symbol => tickerRow(symbol, `Old ${symbol} Industries`))
        );
        mockAssetRepo.findAll.mockResolvedValue([]);
        mockTranslate.mockImplementation(
            async (entries: { symbol: string }[]) =>
                Object.fromEntries(entries.map(e => [e.symbol, '번역']))
        );

        const counts = await reconcileUsTickerNames();

        expect(counts.renamed).toBe(RENAME_BATCH_MAX);
        expect(counts.deferred).toBe(3);
        expect(mockRevalidateTag).toHaveBeenCalledTimes(RENAME_BATCH_MAX);
    });

    it('후보가 없으면 번역도 쓰기도 하지 않는다', async () => {
        mockTickerRepo.findAllNonKr.mockResolvedValue([
            tickerRow('AAPL', 'Apple Inc', '애플'),
        ]);
        mockAssetRepo.findAll.mockResolvedValue([]);

        const counts = await reconcileUsTickerNames();

        expect(counts.renamed).toBe(0);
        expect(mockTranslate).not.toHaveBeenCalled();
        expect(mockRevalidateTag).not.toHaveBeenCalled();
    });

    it('FMP 실패는 던져서 cron 로그에 남게 하고 아무것도 쓰지 않는다', async () => {
        mockFmpGet.mockRejectedValue(new Error('FMP 503'));

        await expect(reconcileUsTickerNames()).rejects.toThrow('FMP 503');

        expect(mockTickerRepo.upsertMany).not.toHaveBeenCalled();
        expect(mockRevalidateTag).not.toHaveBeenCalled();
    });

    it('stock-list 응답이 배열이 아니면 던진다 (빈 목록으로 흘려 성공처럼 보이지 않게)', async () => {
        mockFmpGet.mockResolvedValue({ error: 'oops' });

        await expect(reconcileUsTickerNames()).rejects.toThrow(
            'stock-list response is not an array'
        );
    });

    it('DB 클라이언트가 없으면 던진다', async () => {
        mockTryGetClient.mockReturnValue(null);

        await expect(reconcileUsTickerNames()).rejects.toThrow(
            'database unavailable'
        );
        expect(mockFmpGet).not.toHaveBeenCalled();
    });

    it('모양이 깨진 stock-list 행은 버리고 나머지로 진행한다', async () => {
        mockFmpGet.mockResolvedValue([
            null,
            { symbol: 'LAZR' },
            { symbol: 'LAZR', companyName: 'Luminar Technologies' },
        ]);

        const counts = await reconcileUsTickerNames();

        expect(counts.renamed).toBe(1);
    });
});
