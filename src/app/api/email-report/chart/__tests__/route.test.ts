vi.mock('@/entities/bars/lib/loadBarsData', () => ({
    loadBarsData: vi.fn(),
}));
vi.mock('@/entities/email-report/emailReportSecret', () => ({
    readEmailReportSecret: vi.fn(),
}));
vi.mock('@/entities/email-report/lib/buildReportChartImage', () => ({
    REPORT_CHART_MA_PERIODS: [20, 60],
    buildReportChartImage: vi.fn(),
}));

import type { Bar } from '@y0ngha/siglens-core';
import { GET } from '@/app/api/email-report/chart/route';
import { loadBarsData } from '@/entities/bars/lib/loadBarsData';
import { readEmailReportSecret } from '@/entities/email-report/emailReportSecret';
import { buildReportChartImage } from '@/entities/email-report/lib/buildReportChartImage';
import { buildChartImageUrl } from '@/entities/email-report/lib/reportLinks';

const SECRET = 'chart-secret-chart-secret-chart-secret';
const mockLoadBars = vi.mocked(loadBarsData);
const mockSecret = vi.mocked(readEmailReportSecret);
const mockBuild = vi.mocked(buildReportChartImage);

function barAt(iso: string, close: number): Bar {
    return {
        time: Date.parse(iso) / 1000,
        open: close,
        high: close,
        low: close,
        close,
        volume: 1,
    };
}

const BARS = [
    barAt('2026-10-07T13:30:00Z', 10),
    barAt('2026-10-08T13:30:00Z', 11),
    barAt('2026-10-09T13:30:00Z', 12),
];

function signedRequest(symbol = 'AAPL', date = '2026-10-08'): Request {
    return new Request(
        buildChartImageUrl('https://siglens.io', SECRET, symbol, date)
    );
}

describe('GET /api/email-report/chart', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSecret.mockReturnValue(SECRET);
        mockLoadBars.mockResolvedValue({
            bars: BARS,
            indicators: { ma: { 20: [1, 2, 3], 60: [4, 5, 6] } },
        } as never);
        mockBuild.mockReturnValue(new Response('png') as never);
    });

    it('서명이 맞으면 기준일까지의 봉과 같은 길이의 이동평균으로 이미지를 그린다', async () => {
        const res = await GET(signedRequest());

        expect(res.status).toBe(200);
        expect(mockLoadBars).toHaveBeenCalledWith('AAPL', '1Day');
        expect(mockBuild).toHaveBeenCalledWith(
            expect.objectContaining({
                symbol: 'AAPL',
                date: '2026-10-08',
                bars: BARS.slice(0, 2),
                ma: { 20: [1, 2], 60: [4, 5] },
                cacheControl: expect.stringContaining('immutable'),
            })
        );
    });

    it('서명이 틀리면 403이고 봉을 조회하지 않는다', async () => {
        const url = new URL(signedRequest().url);
        url.searchParams.set('d', '2026-10-09');

        const res = await GET(new Request(url));

        expect(res.status).toBe(403);
        expect(res.headers.get('cache-control')).toBe('no-store');
        expect(mockLoadBars).not.toHaveBeenCalled();
    });

    it('비밀값이 설정되지 않으면 403이다', async () => {
        mockSecret.mockReturnValue(null);

        const res = await GET(signedRequest());

        expect(res.status).toBe(403);
    });

    it('형식이 틀린 심볼·날짜는 서명 검증 전에 거부한다', async () => {
        const badSymbol = await GET(signedRequest('aapl<script>'));
        const badDate = await GET(signedRequest('AAPL', '20261008'));

        expect(badSymbol.status).toBe(403);
        expect(badDate.status).toBe(403);
        expect(mockLoadBars).not.toHaveBeenCalled();
    });

    it('그릴 봉이 없으면 404다', async () => {
        mockBuild.mockReturnValue(null);

        const res = await GET(signedRequest());

        expect(res.status).toBe(404);
    });

    it('봉 조회가 실패하면 404로 답하고 캐시하지 않는다', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        mockLoadBars.mockRejectedValue(new Error('fmp down'));

        const res = await GET(signedRequest());

        expect(res.status).toBe(404);
        expect(res.headers.get('cache-control')).toBe('no-store');
    });
});
