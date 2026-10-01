// @vitest-environment node
const { mockImageResponse } = vi.hoisted(() => ({
    mockImageResponse: vi.fn(),
}));

vi.mock('next/og', () => ({
    ImageResponse: vi.fn().mockImplementation(function (jsx: unknown) {
        mockImageResponse(jsx);
        return {};
    }),
}));
vi.mock('@/entities/og-image/lib/loadOgFont', () => ({
    loadOgFont: vi.fn().mockResolvedValue(null),
}));

import Image from '@/app/[locale]/news/[category]/opengraph-image';

const HANGUL = /[가-힣]/;

/*
 * 카테고리 라벨이 `koLabel`(AI 프롬프트용, 전 로케일 한국어)이었다. ja/zh OG는
 * 한글 글리프가 없는 Noto Sans JP/SC로 그리므로 한글 라벨은 빈 네모가 된다.
 */
describe('news/[category] opengraph-image', () => {
    beforeEach(() => mockImageResponse.mockClear());

    it.each([
        ['ko', '미국 주식'],
        ['ja', '米国株式'],
        ['zh', '美国股票'],
    ])('%s 로케일 카테고리 라벨을 그린다', async (locale, expected) => {
        await Image({
            params: Promise.resolve({ locale, category: 'stock' }),
        });

        const rendered = JSON.stringify(mockImageResponse.mock.lastCall?.[0]);
        expect(rendered).toContain(expected);
        if (locale !== 'ko') expect(rendered).not.toMatch(HANGUL);
    });
});
