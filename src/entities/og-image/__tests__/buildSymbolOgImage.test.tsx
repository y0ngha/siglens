// @vitest-environment node
import { buildSymbolOgImage } from '../lib/buildSymbolOgImage';
import { OG_IMAGE_CACHE_CONTROL } from '@/shared/lib/og';

const { mockImageResponse, mockLoadKoreanFont } = vi.hoisted(() => ({
    mockImageResponse: vi.fn(),
    mockLoadKoreanFont: vi.fn(),
}));

vi.mock('next/og', () => ({
    ImageResponse: vi.fn().mockImplementation(function (
        jsx: unknown,
        opts: unknown
    ) {
        mockImageResponse(jsx, opts);
        return { jsx, opts } as unknown;
    }),
}));

vi.mock('../lib/loadKoreanFont', () => ({
    loadKoreanFont: vi.fn(() => mockLoadKoreanFont()),
}));

describe('buildSymbolOgImage', () => {
    beforeEach(() => {
        mockImageResponse.mockClear();
        mockLoadKoreanFont.mockReset();
    });

    it('한글 폰트가 로드되면 fonts 옵션에 Pretendard를 포함한다', async () => {
        const fontBuffer = new ArrayBuffer(16);
        mockLoadKoreanFont.mockResolvedValue(fontBuffer);

        await buildSymbolOgImage({ ticker: 'AAPL', label: '차트 분석' });

        const [, opts] = mockImageResponse.mock.calls[0] as [
            unknown,
            { fonts?: Array<{ name: string; data: ArrayBuffer }> },
        ];
        expect(opts.fonts).toEqual([
            expect.objectContaining({
                name: 'Pretendard',
                data: fontBuffer,
                weight: 700,
            }),
        ]);
    });

    it('한글 폰트 로드 실패(null) 시 fonts 옵션을 비워 graceful degrade한다', async () => {
        mockLoadKoreanFont.mockResolvedValue(null);

        await buildSymbolOgImage({ ticker: 'NVDA', label: '뉴스 분석' });

        const [, opts] = mockImageResponse.mock.calls[0] as [
            unknown,
            { fonts?: unknown },
        ];
        expect(opts.fonts).toBeUndefined();
    });

    it('size 옵션은 OG_IMAGE_WIDTH × OG_IMAGE_HEIGHT 1200×630이다', async () => {
        mockLoadKoreanFont.mockResolvedValue(null);

        await buildSymbolOgImage({ ticker: 'TSLA', label: '펀더멘털' });

        const [, opts] = mockImageResponse.mock.calls[0] as [
            unknown,
            { width: number; height: number },
        ];
        expect(opts.width).toBe(1200);
        expect(opts.height).toBe(630);
    });

    // `ImageResponse`의 기본 헤더(`public, max-age=0, must-revalidate`)를 그대로 두면
    // CDN이 매 요청 오리진으로 재검증해 엣지 캐시가 되지 않는다(2026-08-13 실측 히트율 0%).
    // 이 테스트가 깨지면 OG 이미지가 다시 캐시 불가 상태로 회귀한 것이다.
    it('기본 cache-control은 CDN 장기 캐시를 허용한다 (s-maxage 존재)', async () => {
        mockLoadKoreanFont.mockResolvedValue(null);

        await buildSymbolOgImage({ ticker: 'NVDA', label: '차트 분석' });

        const [, opts] = mockImageResponse.mock.calls[0] as [
            unknown,
            { headers: Record<string, string> },
        ];
        expect(opts.headers['cache-control']).toBe(OG_IMAGE_CACHE_CONTROL);
        expect(opts.headers['cache-control']).toMatch(/s-maxage=\d+/);
        expect(opts.headers['cache-control']).not.toContain('must-revalidate');
    });

    it('cacheControl을 넘기면 그 값이 헤더에 반영된다 (/share/[id] 경로)', async () => {
        mockLoadKoreanFont.mockResolvedValue(null);

        await buildSymbolOgImage({
            ticker: 'SIGLENS',
            label: '만료된 공유',
            cacheControl: 'public, max-age=0, must-revalidate',
        });

        const [, opts] = mockImageResponse.mock.calls[0] as [
            unknown,
            { headers: Record<string, string> },
        ];
        expect(opts.headers['cache-control']).toBe(
            'public, max-age=0, must-revalidate'
        );
    });
});
