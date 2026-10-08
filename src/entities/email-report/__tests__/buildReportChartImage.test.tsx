import type { Bar } from '@y0ngha/siglens-core';
import { buildReportChartImage } from '@/entities/email-report/lib/buildReportChartImage';

function bar(i: number): Bar {
    const base = 100 + i;
    return {
        time: 1_790_000_000 + i * 86_400,
        open: base,
        high: base + 2,
        low: base - 2,
        close: i % 2 === 0 ? base + 1 : base - 1,
        volume: 1000,
    };
}

describe('buildReportChartImage', () => {
    it('봉이 없으면 null', () => {
        expect(
            buildReportChartImage({
                symbol: 'AAPL',
                date: '2026-10-08',
                bars: [],
                ma: {},
                cacheControl: 'no-store',
            })
        ).toBeNull();
    });

    it('PNG 응답을 만들고 넘겨받은 cache-control을 단다', async () => {
        const bars = Array.from({ length: 30 }, (_, i) => bar(i));
        const image = buildReportChartImage({
            symbol: 'AAPL',
            date: '2026-10-08',
            bars,
            ma: { 20: bars.map(b => b.close) },
            cacheControl: 'public, max-age=60',
        })!;

        expect(image.headers.get('content-type')).toBe('image/png');
        expect(image.headers.get('cache-control')).toBe('public, max-age=60');
        const bytes = new Uint8Array(await image.arrayBuffer());
        // PNG 시그니처
        expect(Array.from(bytes.subarray(0, 4))).toEqual([
            0x89, 0x50, 0x4e, 0x47,
        ]);
    }, 30_000);
});
