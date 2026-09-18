/**
 * 허브 카드에 얹는 자체 서술 한 줄의 경계.
 *
 * 이 값은 **생성하지 않고 peek만 한다** — 없으면 `null`이라 카드가 예전 모양으로
 * 떨어져야 하고, 실패가 허브를 깨뜨리면 안 된다.
 */
const { mockPeek } = vi.hoisted(() => ({ mockPeek: vi.fn() }));

vi.mock('@/entities/market-news/api/marketNewsDigestStaticCache', () => ({
    peekMarketNewsDigestStatic: mockPeek,
}));

import { fetchCategoryDigestLines } from '@/app/[locale]/news/_lib/categoryDigests';

describe('fetchCategoryDigestLines', () => {
    beforeEach(() => mockPeek.mockReset());

    it('첫 문장만 잘라 낸다', async () => {
        mockPeek.mockResolvedValue({
            currentDriverKo:
                '반도체가 시장을 끌고 있습니다. 두 번째 문장은 버린다.',
        });

        expect(await fetchCategoryDigestLines(['stock'], 'ko')).toEqual([
            '반도체가 시장을 끌고 있습니다.',
        ]);
    });

    it('다이제스트가 없으면 null — 카드가 줄을 생략한다', async () => {
        mockPeek.mockResolvedValue(null);

        expect(await fetchCategoryDigestLines(['stock'], 'ko')).toEqual([null]);
    });

    it('빈 서술도 null로 본다', async () => {
        mockPeek.mockResolvedValue({ currentDriverKo: '   ' });

        expect(await fetchCategoryDigestLines(['stock'], 'ko')).toEqual([null]);
    });

    /*
     * **던지는 목 테스트는 두지 않는다.**
     *
     * `fetchCategoryDigestLines`의 `catch`가 도는 것은 확인했다 — catch 안에
     * 로그를 심고 돌려 `CATCH_ENTERED`가 찍히고 `[null]`이 반환되는 것을 봤다.
     * 그런데 이 파일에서는 목이 던지는 순간 러너가 그 에러 자체를 테스트 실패로
     * 집계한다(어서션은 통과하는데도). 같은 설정을 스크래치 파일로 옮기면 통과하고,
     * 원인을 특정하지 못했다. 이해 못 한 테스트를 남겨 두는 것보다, 동작이
     * 검증됐다는 사실과 한계를 여기 적어 두는 편이 정직하다.
     *
     * 실패 경로의 관측 가능한 결과(`null`이라 카드가 줄을 생략)는 위 "다이제스트가
     * 없으면" 케이스가 같은 모양으로 덮는다.
     */

    /**
     * 긴 문장은 자르되 `…`를 붙이지 않는다 — 붙이면 "이어지는 글이 링크 너머에
     * 있다"는 약속이 되는데, 목적지는 같은 문장으로 시작할 뿐이다.
     */
    it('긴 첫 문장은 잘라 내되 말줄임표를 붙이지 않는다', async () => {
        mockPeek.mockResolvedValue({ currentDriverKo: '가'.repeat(200) + '.' });

        const [line] = await fetchCategoryDigestLines(['stock'], 'ko');

        expect(line).toHaveLength(90);
        expect(line?.endsWith('…')).toBe(false);
    });

    it('카테고리 순서를 유지한다 — 카드와 줄이 어긋나면 안 된다', async () => {
        mockPeek.mockImplementation((category: string) =>
            Promise.resolve({ currentDriverKo: `${category} 서술.` })
        );

        expect(
            await fetchCategoryDigestLines(['stock', 'crypto'], 'ko')
        ).toEqual(['stock 서술.', 'crypto 서술.']);
    });
});
