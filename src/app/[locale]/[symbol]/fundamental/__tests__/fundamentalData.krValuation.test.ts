/**
 * 펀더멘털 탭의 `getKeyMetricsTtm`이 심볼별 provider를 `withKrValuation`으로 감싸 읽는지 — 에이전트·분석 입력과 같은 기준을 보게 하는 배선
 * (TESTING.md#TE-11)을 고정한다. 한국 종목 카드는 `loadPageKrValuation`이 지표와 기준을 한 번에 만든다.
 */
const mocks = vi.hoisted(() => ({
    getFundamentalDataProvider: vi.fn(),
    withKrValuation: vi.fn(),
}));
vi.mock('@/shared/api/fmp/getFundamentalDataProvider', () => ({
    getFundamentalDataProvider: mocks.getFundamentalDataProvider,
}));
vi.mock('@/entities/kr-valuation/server/withKrValuation', () => ({
    withKrValuation: mocks.withKrValuation,
}));
vi.mock('react', async () => {
    const actual = await vi.importActual<typeof import('react')>('react');
    return {
        ...actual,
        cache: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn,
    };
});
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn().mockReturnValue({ db: {} }),
}));
vi.mock('@/entities/ticker/api', () => ({
    DrizzleProfileDescriptionTranslationRepository: vi.fn(),
}));
vi.mock('@/entities/ticker/server/koreanTranslator', () => ({
    translateCompanyDescription: vi.fn(),
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getKeyMetricsTtm } from '@/app/[locale]/[symbol]/fundamental/fundamentalData';

const INNER = { label: 'raw provider', getKeyMetricsTtm: vi.fn() };
const DART_METRICS = {
    peRatioTTM: 7.73,
    priceToSalesRatioTTM: 1.36,
    pbRatioTTM: 0.4961,
    pegRatioTTM: null,
    enterpriseValueOverEBITDATTM: null,
    epsTTM: 5357.98,
};

describe('fundamentalData 한국 밸류에이션 배선', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getFundamentalDataProvider.mockReturnValue(INNER);
    });

    it('getKeyMetricsTtm은 심볼별 provider를 `withKrValuation`으로 감싼 provider에서 읽는다', async () => {
        const wrapped = {
            getKeyMetricsTtm: vi.fn().mockResolvedValue(DART_METRICS),
        };
        mocks.withKrValuation.mockReturnValue(wrapped);
        expect(await getKeyMetricsTtm('029780.KS')).toBe(DART_METRICS);
        expect(mocks.getFundamentalDataProvider).toHaveBeenCalledWith(
            '029780.KS'
        );
        expect(mocks.withKrValuation).toHaveBeenCalledWith(INNER, '029780.KS');
        expect(wrapped.getKeyMetricsTtm).toHaveBeenCalledWith('029780.KS');
        // 감싸지 않은 provider에서 직접 읽지 않는다.
        expect(INNER.getKeyMetricsTtm).not.toHaveBeenCalled();
    });
});
