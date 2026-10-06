// @vitest-environment node
const { mockBuildSymbolOgImage } = vi.hoisted(() => ({
    mockBuildSymbolOgImage: vi.fn(),
}));

vi.mock('@/entities/og-image/lib/buildSymbolOgImage', () => ({
    buildSymbolOgImage: mockBuildSymbolOgImage,
}));

import * as route from '../route';

const get = (file: string): Promise<Response> =>
    route.GET(new Request(`https://ai.siglens.io/api/ai/og/${file}`), {
        params: Promise.resolve({ file }),
    });

describe('GET /api/ai/og/[file]', () => {
    beforeEach(() => {
        mockBuildSymbolOgImage.mockReset();
        mockBuildSymbolOgImage.mockReturnValue(
            new Response(null, { status: 200 })
        );
    });

    it('정적·ISR 라우트다 — force-static, 30일 revalidate, 빌드 때는 그리지 않는다', () => {
        expect(route.dynamic).toBe('force-static');
        expect(route.revalidate).toBe(2592000);
        expect(route.generateStaticParams()).toEqual([]);
    });

    it('경로의 로케일(<locale>.png)로 그 로케일 문구를 그린다', async () => {
        await get('en.png');
        expect(mockBuildSymbolOgImage).toHaveBeenCalledWith({
            ticker: 'SIGLENS AI',
            label: 'Ask AI about stocks & crypto · Beta',
            locale: 'en',
        });
    });

    it('기본 로케일도 같은 모양이다', async () => {
        await get('ko.png');
        expect(mockBuildSymbolOgImage).toHaveBeenCalledWith(
            expect.objectContaining({
                label: '주식·코인, AI에게 물어보세요 · Beta',
                locale: 'ko',
            })
        );
    });

    it.each(['xx.png', 'ko', 'ko.jpg', 'KO.png', '../ko.png'])(
        '지원하지 않는 파일명(%s)은 그리지 않고 404',
        async file => {
            const res = await get(file);
            expect(res.status).toBe(404);
            expect(mockBuildSymbolOgImage).not.toHaveBeenCalled();
        }
    );

    it('buildSymbolOgImage가 반환한 Response를 그대로 반환한다 (Cache-Control 포함)', async () => {
        const response = new Response(null, {
            status: 200,
            headers: { 'Cache-Control': 'public, s-maxage=604800' },
        });
        mockBuildSymbolOgImage.mockReturnValue(response);
        expect(await get('ja.png')).toBe(response);
    });
});
