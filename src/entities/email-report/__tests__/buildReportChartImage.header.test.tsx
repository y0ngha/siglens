const rendered = vi.hoisted(() => ({ element: null as unknown }));

vi.mock('next/og', () => ({
    ImageResponse: class {
        headers = new Headers();
        constructor(element: unknown) {
            rendered.element = element;
        }
    },
}));

import type { Bar } from '@y0ngha/siglens-core';

import { buildReportChartImage } from '@/entities/email-report/server/buildReportChartImage';

function bars(): Bar[] {
    return Array.from({ length: 30 }, (_, i) => ({
        time: 1_790_000_000 + i * 86_400,
        open: 100 + i,
        high: 102 + i,
        low: 98 + i,
        close: 101 + i,
        volume: 1000,
    }));
}

function renderHeader(symbol: string): string {
    buildReportChartImage({
        symbol,
        date: '2026-10-08',
        bars: bars(),
        ma: {},
        cacheControl: 'no-store',
    });
    return JSON.stringify(rendered.element);
}

describe('buildReportChartImage 헤더', () => {
    it('국내 종목은 벤더 접미사 없이 코드만 찍는다', () => {
        const tree = renderHeader('000660.KS');

        expect(tree).toContain('"000660"');
        expect(tree).not.toContain('.KS');
    });

    it('미국 티커는 그대로 찍는다', () => {
        expect(renderHeader('AAPL')).toContain('"AAPL"');
    });
});
