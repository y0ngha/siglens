import { vi, type MockedFunction } from 'vitest';
import { getAssetInfoAction } from '../../actions/getAssetInfoAction';
import { getAssetInfo } from '../../lib/getAssetInfo';
import type { AssetInfo } from '@/shared/lib/types';

vi.mock('../../lib/getAssetInfo', () => ({
    getAssetInfo: vi.fn(),
}));

const mockGetAssetInfo = getAssetInfo as MockedFunction<
    typeof getAssetInfo
>;

const assetInfo = { symbol: 'AAPL' } as AssetInfo;

describe('getAssetInfoAction 함수는', () => {
    beforeEach(() => {
        mockGetAssetInfo.mockReset();
    });

    it('symbol을 대문자로 변환해 use-case getAssetInfo에 전달한다', async () => {
        mockGetAssetInfo.mockResolvedValueOnce(assetInfo);

        await getAssetInfoAction('aapl');

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
