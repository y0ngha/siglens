import { afterEach, describe, expect, it, vi } from 'vitest';

const { peekMock } = vi.hoisted(() => ({ peekMock: vi.fn() }));
vi.mock('@/entities/market-news/api/marketNewsDigestStaticCache', () => ({
    peekMarketNewsDigestStatic: peekMock,
}));

import { fetchCategoryDigestLines } from '@/app/[locale]/news/_lib/categoryDigests';

describe('fetchCategoryDigestLines', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        peekMock.mockReset();
    });

    it('다이제스트 조회가 던지면 그 카테고리는 null이고 원인을 로그로 남긴다', async () => {
        const error = new Error('redis down');
        peekMock.mockRejectedValueOnce(error);
        const consoleSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        await expect(
            fetchCategoryDigestLines(['stock'], 'ko')
        ).resolves.toEqual([null]);
        expect(consoleSpy).toHaveBeenCalledWith(
            '[NewsHub] category digest peek failed:',
            'stock',
            error
        );
    });
});
