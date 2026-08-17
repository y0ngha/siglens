import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { KrxListedItem } from '@/shared/api/dataGoKr/krxListedInfoClient';

const {
    mockFetchKrxListedItems,
    mockHasCredentials,
    mockTryGetClient,
    mockInvalidateCache,
    mockRepository,
} = vi.hoisted(() => ({
    mockFetchKrxListedItems: vi.fn(),
    mockHasCredentials: vi.fn(),
    mockTryGetClient: vi.fn(),
    mockInvalidateCache: vi.fn(),
    mockRepository: {
        upsertMany: vi.fn(),
        findAllListingStatuses: vi.fn(),
        markDelisted: vi.fn(),
        markRelisted: vi.fn(),
    },
}));

vi.mock('@/shared/api/dataGoKr/krxListedInfoClient', () => ({
    fetchKrxListedItems: mockFetchKrxListedItems,
    hasDataGoKrCredentials: mockHasCredentials,
}));

vi.mock('../lib/db', () => ({
    tryGetTickerDatabaseClient: mockTryGetClient,
}));

vi.mock('../lib/koreanNameStore', () => ({
    invalidateKoreanTickerCache: mockInvalidateCache,
}));

vi.mock('../api', () => ({
    DrizzleKoreanTickerRepository: class {
        upsertMany = mockRepository.upsertMany;
        findAllListingStatuses = mockRepository.findAllListingStatuses;
        markDelisted = mockRepository.markDelisted;
        markRelisted = mockRepository.markRelisted;
    },
}));

import { syncKrListedTickers } from '../lib/syncKrListedTickers';

function item(
    shortCode: string,
    market: KrxListedItem['market']
): KrxListedItem {
    return {
        shortCode,
        koreanName: `종목${shortCode}`,
        market,
        isin: `KR${shortCode}`,
        corpName: `법인${shortCode}`,
    };
}

/** 절대 하한(1,000)을 넘기는 응답 — 가드를 통과시키고 싶을 때 쓴다. */
function bulkItems(count: number): KrxListedItem[] {
    return Array.from({ length: count }, (_, i) =>
        item(String(100_000 + i), 'KOSPI')
    );
}

describe('syncKrListedTickers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockHasCredentials.mockReturnValue(true);
        mockTryGetClient.mockReturnValue({ db: {} });
        mockRepository.findAllListingStatuses.mockResolvedValue([]);
        mockRepository.upsertMany.mockResolvedValue(undefined);
        mockRepository.markDelisted.mockResolvedValue(undefined);
        mockRepository.markRelisted.mockResolvedValue(undefined);
        mockInvalidateCache.mockResolvedValue(undefined);
    });

    it('자격 증명이 없으면 던진다 — 조용히 no-op하면 마스터가 굳는다', async () => {
        mockHasCredentials.mockReturnValue(false);
        await expect(syncKrListedTickers()).rejects.toThrow(
            'DATA_GO_KR_SERVICE_KEY'
        );
        expect(mockFetchKrxListedItems).not.toHaveBeenCalled();
    });

    it('DB를 못 잡으면 던진다', async () => {
        mockTryGetClient.mockReturnValue(null);
        await expect(syncKrListedTickers()).rejects.toThrow(
            'database unavailable'
        );
    });

    it('KONEX는 upsert에서 빠진다 — yahoo에 시세가 없어 죽은 링크가 된다', async () => {
        mockFetchKrxListedItems.mockResolvedValue([
            item('005930', 'KOSPI'),
            item('247540', 'KOSDAQ'),
            item('999999', 'KONEX'),
        ]);

        const counts = await syncKrListedTickers();

        const upserted = mockRepository.upsertMany.mock.calls[0]![0] as {
            symbol: string;
        }[];
        expect(upserted.map(r => r.symbol)).toEqual(['005930.KS', '247540.KQ']);
        expect(counts.fetched).toBe(2);
    });

    it('사라진 종목을 상폐 표시하고 캐시를 비운다', async () => {
        const items = bulkItems(1_200);
        mockFetchKrxListedItems.mockResolvedValue(items);
        mockRepository.findAllListingStatuses.mockResolvedValue([
            ...items.map(i => ({
                symbol: `${i.shortCode}.KS`,
                delistedAt: null,
            })),
            { symbol: 'GONE.KQ', delistedAt: null },
        ]);

        const counts = await syncKrListedTickers();

        expect(mockRepository.markDelisted).toHaveBeenCalledWith(['GONE.KQ']);
        expect(counts.delisted).toBe(1);
        // 검색은 캐시된 전체 목록에 substring 필터를 돌린다 — 비우지 않으면 상폐 종목이
        // TTL 동안 계속 자동완성에 뜬다.
        expect(mockInvalidateCache).toHaveBeenCalledOnce();
    });

    it('부분 응답이면 상폐를 건너뛰고 upsert만 한다', async () => {
        mockFetchKrxListedItems.mockResolvedValue([item('005930', 'KOSPI')]);
        mockRepository.findAllListingStatuses.mockResolvedValue(
            bulkItems(2_500).map(i => ({
                symbol: `${i.shortCode}.KS`,
                delistedAt: null,
            }))
        );

        const counts = await syncKrListedTickers();

        expect(counts.guardTrip).not.toBeNull();
        expect(counts.delisted).toBe(0);
        expect(mockRepository.markDelisted).toHaveBeenCalledWith([]);
        expect(mockRepository.upsertMany).toHaveBeenCalledOnce();
    });

    /**
     * `korean_tickers`는 이름과 달리 미국 종목도 담는다(프로덕션 실측 32,951행 중 국내
     * 2,595행). 리포지토리가 전량을 돌려주면 미국 종목이 전부 "사라진 종목"으로 잡혀
     * 가드가 매일 걸리고 상폐 처리가 영영 일어나지 않는다 — 가드가 파국은 막지만
     * 기능은 통째로 죽는다. 그 계약이 리포지토리 쪽에 있다는 것을 여기서도 못박는다.
     */
    it('[회귀] 미국 종목이 섞여 들어오면 가드가 걸려 상폐가 통째로 멈춘다', async () => {
        const items = bulkItems(1_200);
        mockFetchKrxListedItems.mockResolvedValue(items);
        mockRepository.findAllListingStatuses.mockResolvedValue([
            ...items.map(i => ({
                symbol: `${i.shortCode}.KS`,
                delistedAt: null,
            })),
            // 리포지토리가 접미사 필터를 잃으면 이런 행들이 섞여 들어온다.
            ...Array.from({ length: 100 }, (_, i) => ({
                symbol: `US${i}`,
                delistedAt: null,
            })),
        ]);

        const counts = await syncKrListedTickers();

        expect(counts.guardTrip).toContain('vanished in one sync');
        expect(counts.delisted).toBe(0);
    });

    it('다시 상장된 종목은 표시를 해제한다', async () => {
        const items = bulkItems(1_200);
        mockFetchKrxListedItems.mockResolvedValue(items);
        mockRepository.findAllListingStatuses.mockResolvedValue(
            items.map((i, idx) => ({
                symbol: `${i.shortCode}.KS`,
                delistedAt: idx === 0 ? new Date('2026-01-01') : null,
            }))
        );

        const counts = await syncKrListedTickers();

        expect(mockRepository.markRelisted).toHaveBeenCalledWith([
            `${items[0]!.shortCode}.KS`,
        ]);
        expect(counts.relisted).toBe(1);
    });
});
