import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * `kr-trending`은 업종이 아니라 수요 묶음이다. 테마 그룹에 들어가면 서로 무관한 종목이
 * "관련 종목"으로 연결된다. 아직 실제 config에는 이 카테고리가 없으므로(스크립트가 첫
 * 후보 때 생성) 목으로 주입해 검증한다.
 */
describe('relatedSymbols — kr-trending 제외', () => {
    afterEach(() => {
        vi.doUnmock('@/shared/config/popular-tickers');
        vi.resetModules();
    });

    it('kr-trending 항목끼리 테마 피어가 되지 않는다', async () => {
        vi.resetModules();
        vi.doMock('@/shared/config/popular-tickers', async () => {
            const actual = await vi.importActual<
                typeof import('@/shared/config/popular-tickers')
            >('@/shared/config/popular-tickers');
            return {
                ...actual,
                TICKER_CATEGORIES: [
                    ...actual.TICKER_CATEGORIES,
                    {
                        id: 'kr-trending',
                        label: '관심 급상승',
                        items: [
                            { symbol: '111110.KS', name: '가' },
                            { symbol: '222220.KQ', name: '나' },
                        ],
                    },
                ],
            };
        });
        const { themePeersOf } = await import('@/shared/config/relatedSymbols');

        expect(themePeersOf('111110.KS')).not.toContain('222220.KQ');
    });
});
