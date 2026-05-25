import type { MockedFunction } from 'vitest';
import { getSectorSignalsAction } from '../actions/getSectorSignalsAction';
import { getSectorSignals } from '@y0ngha/siglens-core';
import type { SectorSignalsResult } from '@y0ngha/siglens-core';

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    getSectorSignals: vi.fn(),
}));

const mockGetSectorSignals = getSectorSignals as MockedFunction<
    typeof getSectorSignals
>;

const sectorResult: SectorSignalsResult = {
    computedAt: '2026-01-01T00:00:00Z',
    stocks: [],
};

describe('getSectorSignalsAction 함수는', () => {
    beforeEach(() => {
        mockGetSectorSignals.mockReset();
    });

    it('timeframe 인자 없이 siglens-core getSectorSignals를 호출한다', async () => {
        mockGetSectorSignals.mockResolvedValueOnce(sectorResult);

        await getSectorSignalsAction();

        expect(mockGetSectorSignals).toHaveBeenCalledWith(undefined);
    });

    it('timeframe 인자를 siglens-core getSectorSignals에 그대로 전달한다', async () => {
        mockGetSectorSignals.mockResolvedValueOnce(sectorResult);

        await getSectorSignalsAction('1Day');

        expect(mockGetSectorSignals).toHaveBeenCalledWith('1Day');
    });

    it('underlying 함수의 결과를 그대로 반환한다', async () => {
        mockGetSectorSignals.mockResolvedValueOnce(sectorResult);

        const result = await getSectorSignalsAction('1Hour');

        expect(result).toBe(sectorResult);
    });

    it('에러 발생 시 빈 결과를 반환한다', async () => {
        mockGetSectorSignals.mockRejectedValueOnce(new Error('network error'));

        const result = await getSectorSignalsAction();
        expect(result.stocks).toEqual([]);
        expect(result.computedAt).toBeDefined();
    });
});
