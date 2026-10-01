// @vitest-environment node
import { buildSymbolOgImage } from '../lib/buildSymbolOgImage';
import { OG_IMAGE_CACHE_CONTROL } from '@/shared/lib/og';

const { mockImageResponse, mockLoadOgFont } = vi.hoisted(() => ({
    mockImageResponse: vi.fn(),
    mockLoadOgFont: vi.fn(),
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

vi.mock('../lib/loadOgFont', () => ({
    loadOgFont: vi.fn((locale: string) => mockLoadOgFont(locale)),
}));

describe('buildSymbolOgImage', () => {
    beforeEach(() => {
        mockImageResponse.mockClear();
        mockLoadOgFont.mockReset();
    });

    it('로케일 폰트를 받아 fonts 옵션에 그대로 싣는다', async () => {
        const font = {
            name: 'Noto Sans JP',
            data: new ArrayBuffer(16),
            style: 'normal',
            weight: 700,
        };
        mockLoadOgFont.mockResolvedValue(font);

        await buildSymbolOgImage({
            ticker: 'AAPL',
            label: 'チャート分析',
            locale: 'ja',
        });

        expect(mockLoadOgFont).toHaveBeenCalledWith('ja');
        const [, opts] = mockImageResponse.mock.calls[0] as [
            unknown,
            { fonts?: unknown[] },
        ];
        expect(opts.fonts).toEqual([font]);
    });

    it('폰트 로드 실패(null) 시 fonts 옵션을 비워 graceful degrade한다', async () => {
        mockLoadOgFont.mockResolvedValue(null);

        await buildSymbolOgImage({
            ticker: 'NVDA',
            label: '뉴스 분석',
            locale: 'ko',
        });

        const [, opts] = mockImageResponse.mock.calls[0] as [
            unknown,
            { fonts?: unknown },
        ];
        expect(opts.fonts).toBeUndefined();
    });

    it('size 옵션은 OG_IMAGE_WIDTH × OG_IMAGE_HEIGHT 1200×630이다', async () => {
        mockLoadOgFont.mockResolvedValue(null);

        await buildSymbolOgImage({
            ticker: 'TSLA',
            label: '펀더멘털',
            locale: 'ko',
        });

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
        mockLoadOgFont.mockResolvedValue(null);

        await buildSymbolOgImage({
            ticker: 'NVDA',
            label: '차트 분석',
            locale: 'ko',
        });

        const [, opts] = mockImageResponse.mock.calls[0] as [
            unknown,
            { headers: Record<string, string> },
        ];
        expect(opts.headers['cache-control']).toBe(OG_IMAGE_CACHE_CONTROL);
        expect(opts.headers['cache-control']).toMatch(/s-maxage=\d+/);
        expect(opts.headers['cache-control']).not.toContain('must-revalidate');
    });

    it('cacheControl을 넘기면 그 값이 헤더에 반영된다 (/share/[id] 경로)', async () => {
        mockLoadOgFont.mockResolvedValue(null);

        await buildSymbolOgImage({
            ticker: 'SIGLENS',
            label: '만료된 공유',
            locale: 'ko',
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
