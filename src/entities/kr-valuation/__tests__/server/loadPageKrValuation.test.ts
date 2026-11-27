const mocks = vi.hoisted(() => ({
    resolveKrPageValuation: vi.fn(),
    getFundamentalDataProvider: vi.fn(),
    cache: new Map<string, unknown>(),
}));
vi.mock('server-only', () => ({}));
vi.mock('../../server/withKrValuation', () => ({
    resolveKrPageValuation: mocks.resolveKrPageValuation,
}));
vi.mock('@/shared/api/fmp/getFundamentalDataProvider', () => ({
    getFundamentalDataProvider: mocks.getFundamentalDataProvider,
}));
// 데이터 캐시처럼 동작한다: 로더가 값을 돌려주면 저장하고, 던지면 저장하지 않고 그대로 전파한다.
vi.mock('@/shared/cache/staticSymbolCache', () => ({
    staticSymbolCache: async (
        keyParts: readonly string[],
        _symbol: string,
        loader: () => Promise<unknown>
    ) => {
        const key = keyParts.join('|');
        if (mocks.cache.has(key)) return mocks.cache.get(key);
        const value = await loader();
        mocks.cache.set(key, value);
        return value;
    },
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadPageKrValuation } from '../../server/loadPageKrValuation';

const PROVIDER = { label: 'provider' };
const PAGE = {
    metrics: { peRatioTTM: 7.7 },
    basis: { source: 'dart' },
    transient: false,
};
const TRANSIENT_PAGE = {
    metrics: { peRatioTTM: 7.4 },
    basis: { source: 'provider' },
    transient: true,
};

describe('loadPageKrValuation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.cache.clear();
        mocks.getFundamentalDataProvider.mockReturnValue(PROVIDER);
    });

    it('지표와 기준을 한 번의 계산에서 돌려주고 같은 키로 캐시한다', async () => {
        mocks.resolveKrPageValuation.mockResolvedValue(PAGE);
        expect(await loadPageKrValuation('029780.KS')).toEqual(PAGE);
        expect(await loadPageKrValuation('029780.KS')).toEqual(PAGE);
        // 두 번째 호출은 캐시가 받았다.
        expect(mocks.resolveKrPageValuation).toHaveBeenCalledTimes(1);
        expect(mocks.resolveKrPageValuation).toHaveBeenCalledWith(
            PROVIDER,
            '029780.KS'
        );
        expect([...mocks.cache.keys()]).toEqual([
            'fundamental:kr-valuation-v1|029780.KS',
        ]);
    });

    it('일시적 대체 값은 호출부에 돌려주되 캐시에 굳히지 않는다', async () => {
        mocks.resolveKrPageValuation.mockResolvedValue(TRANSIENT_PAGE);
        expect(await loadPageKrValuation('029780.KS')).toEqual(TRANSIENT_PAGE);
        expect(mocks.cache.size).toBe(0);

        // DART가 돌아오면 다음 렌더가 다시 계산해 DART 값을 캐시한다.
        mocks.resolveKrPageValuation.mockResolvedValue(PAGE);
        expect(await loadPageKrValuation('029780.KS')).toEqual(PAGE);
        expect(mocks.cache.size).toBe(1);
    });

    it('그 밖의 오류는 그대로 전파한다', async () => {
        const failure = new Error('provider down');
        mocks.resolveKrPageValuation.mockRejectedValue(failure);
        await expect(loadPageKrValuation('029780.KS')).rejects.toBe(failure);
    });
});
