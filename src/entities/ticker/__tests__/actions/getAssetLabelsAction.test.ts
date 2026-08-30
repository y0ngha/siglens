import type { MockedFunction } from 'vitest';
import { getAssetLabelsAction } from '../../actions/getAssetLabelsAction';
import { getAssetInfo } from '../../lib/getAssetInfo';
import { MAX_RECENT_SEARCHES } from '../../lib/recentSearches';
import type { AssetInfo } from '@/shared/lib/types';

vi.mock('../../lib/getAssetInfo', () => ({
    getAssetInfo: vi.fn(),
}));

const mockGetAssetInfo = getAssetInfo as MockedFunction<typeof getAssetInfo>;

function info(partial: Partial<AssetInfo> & { symbol: string }): AssetInfo {
    return { name: partial.symbol, ...partial } as AssetInfo;
}

describe('getAssetLabelsAction 함수는', () => {
    beforeEach(() => {
        mockGetAssetInfo.mockReset();
    });

    it('심볼을 대문자로 정규화해 조회한다', async () => {
        mockGetAssetInfo.mockResolvedValue(
            info({ symbol: 'AAPL', name: 'Apple Inc.' })
        );

        const result = await getAssetLabelsAction([' aapl ']);

        expect(mockGetAssetInfo).toHaveBeenCalledWith('AAPL');
        expect(result.labels).toEqual({ AAPL: 'Apple Inc.' });
    });

    it('중복 심볼은 한 번만 조회한다', async () => {
        mockGetAssetInfo.mockResolvedValue(
            info({ symbol: 'AAPL', name: 'Apple Inc.' })
        );

        await getAssetLabelsAction(['AAPL', 'aapl', 'AAPL']);

        expect(mockGetAssetInfo).toHaveBeenCalledTimes(1);
    });

    it('최근 검색 상한을 넘는 심볼은 자른다', async () => {
        mockGetAssetInfo.mockImplementation(async symbol =>
            info({ symbol, name: `${symbol} Inc.` })
        );
        const symbols = Array.from(
            { length: MAX_RECENT_SEARCHES + 3 },
            (_, i) => `SYM${i}`
        );

        await getAssetLabelsAction(symbols);

        expect(mockGetAssetInfo).toHaveBeenCalledTimes(MAX_RECENT_SEARCHES);
    });

    it('한글명이 있으면 영문명보다 우선한다', async () => {
        mockGetAssetInfo.mockResolvedValue(
            info({
                symbol: '005930.KS',
                name: 'Samsung Electronics Co., Ltd.',
                koreanName: '삼성전자',
            })
        );

        const result = await getAssetLabelsAction(['005930.KS']);

        expect(result.labels).toEqual({ '005930.KS': '삼성전자' });
    });

    it('이름이 심볼과 같으면 라벨로 쓰지 않는다', async () => {
        // 이 값을 그대로 돌려주면 호출부가 "채웠다"고 판단해 재조회를 막는데,
        // 화면에는 여전히 티커가 보인다.
        mockGetAssetInfo.mockResolvedValue(info({ symbol: 'LAES' }));

        const result = await getAssetLabelsAction(['LAES']);

        expect(result.labels).toEqual({});
        expect(result.failed).toEqual([]);
    });

    it('공백뿐인 이름은 무시한다', async () => {
        mockGetAssetInfo.mockResolvedValue(
            info({ symbol: 'IONQ', name: '   ' })
        );

        const result = await getAssetLabelsAction(['IONQ']);

        expect(result.labels).toEqual({});
    });

    it('null(해당 종목 없음)은 실패가 아니다', async () => {
        // 실패로 치면 호출부가 매 마운트 재조회한다 — 결과가 바뀌지 않는데도.
        mockGetAssetInfo.mockResolvedValue(null);

        const result = await getAssetLabelsAction(['NOPE']);

        expect(result.labels).toEqual({});
        expect(result.failed).toEqual([]);
    });

    it('한 심볼이 throw해도 나머지 심볼의 이름은 돌려준다', async () => {
        // `getAssetInfo`는 FMP 인프라 장애에서 throw한다(throwOnInfraFailure).
        // `Promise.all`이면 여기서 배치 전체가 날아갔다.
        mockGetAssetInfo.mockImplementation(async symbol => {
            if (symbol === 'BOOM') throw new Error('FMP 503');
            return info({ symbol, name: `${symbol} Inc.` });
        });

        const result = await getAssetLabelsAction(['AAPL', 'BOOM', 'TSLA']);

        expect(result.labels).toEqual({
            AAPL: 'AAPL Inc.',
            TSLA: 'TSLA Inc.',
        });
        expect(result.failed).toEqual(['BOOM']);
    });

    it('빈 문자열 심볼은 걸러낸다', async () => {
        const result = await getAssetLabelsAction(['', '   ']);

        expect(mockGetAssetInfo).not.toHaveBeenCalled();
        expect(result).toEqual({ labels: {}, failed: [] });
    });
});
