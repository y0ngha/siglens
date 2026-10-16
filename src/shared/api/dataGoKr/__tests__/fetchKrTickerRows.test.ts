import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockMaster, mockSupplement } = vi.hoisted(() => ({
    mockMaster: vi.fn(),
    mockSupplement: vi.fn(),
}));

vi.mock('../krxListedInfoClient', () => ({
    fetchKrxListedItems: mockMaster,
    fetchStockPriceItems: mockSupplement,
}));

import type { KrxListedItem } from '../krxListedInfoClient';
import { fetchKrTickerRows } from '../fetchKrTickerRows';

function item(
    shortCode: string,
    market: KrxListedItem['market'],
    koreanName = `종목${shortCode}`
): KrxListedItem {
    return {
        shortCode,
        koreanName,
        market,
        isin: `KR${shortCode}`,
        corpName: koreanName,
        basDt: '20261014',
        listedShares: null,
    };
}

describe('fetchKrTickerRows', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('마스터에 없는 코드만 보충하고, 보충 기준일은 마스터 기준일이다', async () => {
        mockMaster.mockResolvedValue([item('005380', 'KOSPI', '현대차')]);
        mockSupplement.mockResolvedValue({
            items: [
                item('005380', 'KOSPI', '현대차'), // 마스터와 중복 — 빠져야 한다
                item('005387', 'KOSPI', '현대차2우B'),
                item('00088K', 'KOSPI', '한화3우B'),
                item('900999', 'KONEX'), // KONEX — 빠져야 한다
            ],
            truncated: false,
        });

        const r = await fetchKrTickerRows();

        expect(mockSupplement).toHaveBeenCalledWith('20261014');
        expect(r.rows.map(x => [x.symbol, x.koreanName])).toEqual([
            ['005380.KS', '현대차'],
            ['005387.KS', '현대차2우B'],
            ['00088K.KS', '한화3우B'],
        ]);
        expect(r.supplemented).toBe(2);
        expect(r.supplementUnavailable).toBe(false);
        expect(r.masterItems).toHaveLength(1);
    });

    it('마스터 행에도 같은 코드의 보충 상장주식수를 붙인다', async () => {
        mockMaster.mockResolvedValue([item('005380', 'KOSPI', '현대차')]);
        mockSupplement.mockResolvedValue({
            items: [
                { ...item('005380', 'KOSPI'), listedShares: 204_757_766 },
                { ...item('005387', 'KOSPI'), listedShares: 36_613_865 },
            ],
            truncated: false,
        });

        const r = await fetchKrTickerRows();

        expect(r.rows.map(x => [x.symbol, x.listedShares])).toEqual([
            ['005380.KS', 204_757_766],
            ['005387.KS', 36_613_865],
        ]);
    });

    it('보충을 받지 못하면 상장주식수는 비어 있다(upsert가 저장된 값을 지우지 않는다)', async () => {
        mockMaster.mockResolvedValue([item('005380', 'KOSPI')]);
        mockSupplement.mockResolvedValue({ items: [], truncated: false });

        const r = await fetchKrTickerRows();

        expect(r.rows.map(x => x.listedShares)).toEqual([null]);
    });

    it('시장 구분이 어긋나도 같은 코드는 보충하지 않는다', async () => {
        // 시장 이전일: 마스터는 KOSDAQ, 시세는 KOSPI로 줄 수 있다 — 심볼로 비교하면 이중 행이 생긴다.
        mockMaster.mockResolvedValue([item('123450', 'KOSDAQ')]);
        mockSupplement.mockResolvedValue({
            items: [item('123450', 'KOSPI')],
            truncated: false,
        });

        const r = await fetchKrTickerRows();

        expect(r.rows.map(x => x.symbol)).toEqual(['123450.KQ']);
        expect(r.supplemented).toBe(0);
    });

    it('보충이 던지면 마스터 행만 돌려주고 보충 불가로 표시한다', async () => {
        mockMaster.mockResolvedValue([item('005380', 'KOSPI')]);
        mockSupplement.mockRejectedValue(
            new Error('[stockPriceInfo] HTTP 500')
        );

        const r = await fetchKrTickerRows();

        expect(r.rows.map(x => x.symbol)).toEqual(['005380.KS']);
        expect(r.supplementUnavailable).toBe(true);
        expect(r.supplemented).toBe(0);
    });

    it('보충이 0건이면 보충 불가다', async () => {
        mockMaster.mockResolvedValue([item('005380', 'KOSPI')]);
        mockSupplement.mockResolvedValue({ items: [], truncated: false });

        expect((await fetchKrTickerRows()).supplementUnavailable).toBe(true);
    });

    it('보충이 잘렸으면 받은 만큼도 쓰지 않고 보충 불가다', async () => {
        // 잘린 보충으로 판정하면 빠진 페이지의 우선주가 25개 미만일 때 대량 상폐 가드를
        // 그대로 통과해 조용히 상폐된다.
        mockMaster.mockResolvedValue([item('005380', 'KOSPI')]);
        mockSupplement.mockResolvedValue({
            items: [item('005387', 'KOSPI')],
            truncated: true,
        });

        const r = await fetchKrTickerRows();

        expect(r.supplementUnavailable).toBe(true);
        expect(r.rows.map(x => x.symbol)).toEqual(['005380.KS']);
    });

    it('마스터가 비면 보충을 부르지 않는다', async () => {
        mockMaster.mockResolvedValue([]);

        const r = await fetchKrTickerRows();

        expect(mockSupplement).not.toHaveBeenCalled();
        expect(r.supplementUnavailable).toBe(true);
        expect(r.rows).toEqual([]);
    });
});
