import { getAssetInfoAction } from '@/infrastructure/ticker/getAssetInfoAction';
import { getAssetInfo } from '@y0ngha/siglens-core';
import type { AssetInfo } from '@/domain/types';

jest.mock('@y0ngha/siglens-core', () => ({
    ...jest.requireActual('@y0ngha/siglens-core'),
    getAssetInfo: jest.fn(),
}));

const mockGetAssetInfo = getAssetInfo as jest.MockedFunction<
    typeof getAssetInfo
>;

const assetInfo = { symbol: 'AAPL' } as AssetInfo;

describe('getAssetInfoAction 함수는', () => {
    beforeEach(() => {
        mockGetAssetInfo.mockReset();
    });

    it('symbol을 siglens-core getAssetInfo에 그대로 전달한다', async () => {
        mockGetAssetInfo.mockResolvedValueOnce(assetInfo);

        await getAssetInfoAction('AAPL');

        expect(mockGetAssetInfo).toHaveBeenCalledWith('AAPL');
    });

    it('underlying 함수의 결과를 그대로 반환한다', async () => {
        mockGetAssetInfo.mockResolvedValueOnce(assetInfo);

        const result = await getAssetInfoAction('AAPL');

        expect(result).toBe(assetInfo);
    });

    it('null 결과도 그대로 반환한다', async () => {
        mockGetAssetInfo.mockResolvedValueOnce(null);

        const result = await getAssetInfoAction('UNKNOWN');

        expect(result).toBeNull();
    });
});
