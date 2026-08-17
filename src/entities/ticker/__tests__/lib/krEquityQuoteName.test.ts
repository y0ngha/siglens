import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetQuote } = vi.hoisted(() => ({ mockGetQuote: vi.fn() }));

vi.mock('@/shared/api/yahoo/YahooMarketProvider', () => ({
    YahooMarketProvider: class {
        getQuote = mockGetQuote;
    },
}));

import { fetchKrEquityQuoteName } from '@/entities/ticker/lib/krEquityQuoteName';

/**
 * `null`은 "이름을 못 찾았다"가 아니라 **"그런 종목이 없다"**를 뜻한다. 호출부
 * (`resolveKrEquityAssetInfo`)가 그 값을 그대로 `notFound()`로 흘리므로, 형상만 맞는
 * 가짜 티커(`999999.KS`)가 빈 종목 페이지로 렌더되지 않게 막는 지점이 여기다.
 */
describe('fetchKrEquityQuoteName', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.E2E_TEST;
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    describe('프로덕션 경로 (yahoo)', () => {
        it('quote가 있으면 그 이름을 돌려준다', async () => {
            mockGetQuote.mockResolvedValue({
                name: 'Samsung Electronics Co., Ltd.',
            });
            await expect(fetchKrEquityQuoteName('005930.KS')).resolves.toBe(
                'Samsung Electronics Co., Ltd.'
            );
        });

        it('quote가 없으면 null — 심볼로 폴백하지 않는다', async () => {
            // 폴백하면 미상장 코드가 404 대신 빈 페이지로 렌더된다.
            mockGetQuote.mockResolvedValue(null);
            await expect(
                fetchKrEquityQuoteName('999999.KS')
            ).resolves.toBeNull();
        });

        it('quote에 이름이 없어도 null', async () => {
            mockGetQuote.mockResolvedValue({ name: undefined });
            await expect(
                fetchKrEquityQuoteName('005930.KS')
            ).resolves.toBeNull();
        });

        it('yahoo가 던져도 null로 수렴한다 — 렌더를 죽이지 않는다', async () => {
            mockGetQuote.mockRejectedValue(new Error('ETIMEDOUT'));
            await expect(
                fetchKrEquityQuoteName('005930.KS')
            ).resolves.toBeNull();
        });
    });

    /**
     * E2E 빌드에는 외부 키가 없고 다른 provider는 전부 fake로 가는데 이 함수만 yahoo에
     * 직접 붙어 있었다. 큐레이션 카탈로그를 실재 여부의 근거로 삼으면 "시드된 종목은
     * 렌더 / 형상만 맞는 가짜 티커는 404"라는 실제 계약이 그대로 재현된다.
     */
    describe('E2E seam', () => {
        beforeEach(() => {
            process.env.E2E_TEST = '1';
        });

        it('카탈로그에 있는 종목은 한글명을 돌려주고 yahoo를 부르지 않는다', async () => {
            await expect(fetchKrEquityQuoteName('005930.KS')).resolves.toBe(
                '삼성전자'
            );
            expect(mockGetQuote).not.toHaveBeenCalled();
        });

        it('소문자 입력도 카탈로그에 걸린다', async () => {
            await expect(fetchKrEquityQuoteName('005930.ks')).resolves.toBe(
                '삼성전자'
            );
        });

        it('카탈로그 밖 코드는 null — 404 계약이 유지된다', async () => {
            await expect(
                fetchKrEquityQuoteName('999999.KS')
            ).resolves.toBeNull();
            expect(mockGetQuote).not.toHaveBeenCalled();
        });
    });
});
