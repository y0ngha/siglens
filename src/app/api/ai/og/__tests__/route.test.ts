// @vitest-environment node
const { mockBuildSymbolOgImage } = vi.hoisted(() => ({
    mockBuildSymbolOgImage: vi.fn(),
}));

vi.mock('@/entities/og-image', () => ({
    buildSymbolOgImage: mockBuildSymbolOgImage,
}));

import { GET } from '../route';

describe('GET /api/ai/og', () => {
    beforeEach(() => {
        mockBuildSymbolOgImage.mockReset();
        mockBuildSymbolOgImage.mockReturnValue(
            new Response(null, { status: 200 })
        );
    });

    it('locale이 없으면 기본 로케일(ko) 문구로 OG 이미지를 만든다', async () => {
        await GET(new Request('https://ai.siglens.io/api/ai/og'));

        expect(mockBuildSymbolOgImage).toHaveBeenCalledWith({
            ticker: 'SIGLENS AI',
            label: '주식·코인, AI에게 물어보세요 · Beta',
        });
    });

    it('지원하는 locale 쿼리를 받으면 그 로케일 문구를 쓴다', async () => {
        await GET(new Request('https://ai.siglens.io/api/ai/og?locale=en'));

        expect(mockBuildSymbolOgImage).toHaveBeenCalledWith({
            ticker: 'SIGLENS AI',
            label: 'Ask AI about stocks & crypto · Beta',
        });
    });

    it('지원하지 않는 locale 값은 기본 로케일로 좁힌다', async () => {
        await GET(new Request('https://ai.siglens.io/api/ai/og?locale=xx'));

        expect(mockBuildSymbolOgImage).toHaveBeenCalledWith({
            ticker: 'SIGLENS AI',
            label: '주식·코인, AI에게 물어보세요 · Beta',
        });
    });

    it('ticker는 항상 SIGLENS AI 고정이다 (심볼 OG와 공유하는 빌더를 랜딩용으로 재사용)', async () => {
        await GET(new Request('https://ai.siglens.io/api/ai/og?locale=ja'));

        expect(mockBuildSymbolOgImage).toHaveBeenCalledWith(
            expect.objectContaining({ ticker: 'SIGLENS AI' })
        );
    });

    it('buildSymbolOgImage가 반환한 Response를 그대로 반환한다', async () => {
        const response = new Response(null, { status: 200 });
        mockBuildSymbolOgImage.mockReturnValue(response);

        const result = await GET(
            new Request('https://ai.siglens.io/api/ai/og')
        );

        expect(result).toBe(response);
    });
});
