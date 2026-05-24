jest.mock('../../actions/getAssetInfoAction', () => ({
    getAssetInfoAction: jest.fn(),
}));

import { getAssetInfoCached } from '../../lib/getAssetInfoCached';
import { getAssetInfoAction } from '../../actions/getAssetInfoAction';

const mockGetAssetInfoAction = getAssetInfoAction as jest.MockedFunction<
    typeof getAssetInfoAction
>;

describe('getAssetInfoCached', () => {
    beforeEach(() => {
        mockGetAssetInfoAction.mockReset();
    });

    it('getAssetInfoAction의 결과를 그대로 위임 반환한다', async () => {
        const fakeAsset = {
            symbol: 'AAPL',
            name: 'Apple Inc.',
            koreanName: '애플',
            fmpSymbol: 'AAPL',
        };
        mockGetAssetInfoAction.mockResolvedValue(
            fakeAsset as unknown as Awaited<
                ReturnType<typeof getAssetInfoAction>
            >
        );

        const result = await getAssetInfoCached('AAPL');

        expect(result).toEqual(fakeAsset);
    });

    it('null 반환도 그대로 위임한다', async () => {
        mockGetAssetInfoAction.mockResolvedValue(null);

        const result = await getAssetInfoCached('UNKNOWN');

        expect(result).toBeNull();
    });

    it('자체 cache 처리 없이 매 호출이 underlying action으로 위임된다 (jest 환경엔 React render pass 없음)', async () => {
        mockGetAssetInfoAction.mockResolvedValue(null);

        await getAssetInfoCached('AAPL');
        await getAssetInfoCached('AAPL');

        // React.cache는 React render lifetime 안에서만 dedupe하므로,
        // jest 환경(non-RSC)에선 두 호출이 모두 underlying action을 통과한다.
        // 실제 SSR 환경에서의 dedupe는 React 자체 동작이라 별도 검증 대상이 아님.
        expect(mockGetAssetInfoAction).toHaveBeenCalledTimes(2);
    });
});
