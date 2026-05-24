/**
 * @jest-environment node
 */
import { buildSymbolOgImage } from '@/infrastructure/og/buildSymbolOgImage';

const mockImageResponse = jest.fn();
const mockLoadKoreanFont = jest.fn();

jest.mock('next/og', () => ({
    ImageResponse: jest
        .fn()
        .mockImplementation((jsx: unknown, opts: unknown) => {
            mockImageResponse(jsx, opts);
            return { jsx, opts } as unknown;
        }),
}));

jest.mock('@/infrastructure/og/loadKoreanFont', () => ({
    loadKoreanFont: jest.fn(() => mockLoadKoreanFont()),
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
});
