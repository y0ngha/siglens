vi.mock('@/entities/bars/server/loadBarsData', () => ({
    loadBarsData: vi.fn(),
}));
vi.mock('@/entities/email-report/emailReportSecret', () => ({
    readEmailReportSecret: vi.fn(),
}));
vi.mock('@/entities/email-report/server/buildReportChartImage', () => ({
    buildReportChartImage: vi.fn(),
}));
vi.mock('@/app/api/email-report/chart/_lib/loadChartDrawings', () => ({
    loadChartDrawings: vi.fn(),
}));

import type { Bar } from '@y0ngha/siglens-core';
import { loadChartDrawings } from '@/app/api/email-report/chart/_lib/loadChartDrawings';
import { GET } from '@/app/api/email-report/chart/route';
import { loadBarsData } from '@/entities/bars/server/loadBarsData';
import { readEmailReportSecret } from '@/entities/email-report/emailReportSecret';
import {
    buildChartImageUrl,
    chartSignatureValue,
} from '@/entities/email-report/lib/reportLinks';
import { signReportValue } from '@/entities/email-report/lib/reportSignature';
import { buildReportChartImage } from '@/entities/email-report/server/buildReportChartImage';

const SECRET = 'chart-secret-chart-secret-chart-secret';
const mockLoadBars = vi.mocked(loadBarsData);
const mockSecret = vi.mocked(readEmailReportSecret);
const mockBuild = vi.mocked(buildReportChartImage);
const mockDrawings = vi.mocked(loadChartDrawings);

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

const ANALYSIS_AT = new Date('2026-10-07T21:00:00.123Z');
const DRAWINGS = {
    overlays: [],
    overlayColors: {},
    overlayLabels: {},
};

function signedRequest(
    symbol = 'AAPL',
    date = '2026-10-08',
    analysisAt: Date | null = null
): Request {
    return new Request(
        buildChartImageUrl(
            'https://siglens.io',
            SECRET,
            symbol,
            date,
            analysisAt
        )
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
        mockDrawings.mockResolvedValue({ status: 'ok', drawings: DRAWINGS });
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

    describe('분석 시각(a)이 있는 URL', () => {
        it('URL이 가리키는 그 분석의 작도를 읽어 이미지에 넘긴다', async () => {
            const res = await GET(
                signedRequest('AAPL', '2026-10-08', ANALYSIS_AT)
            );

            expect(res.status).toBe(200);
            expect(mockDrawings).toHaveBeenCalledTimes(1);
            expect(mockDrawings).toHaveBeenCalledWith('AAPL', ANALYSIS_AT);
            expect(mockBuild).toHaveBeenCalledWith(
                expect.objectContaining({ drawings: DRAWINGS })
            );
        });

        it('그 행이 없으면(보존 기간 경과) 작도 없는 이미지를 200, 불변 캐시로 낸다', async () => {
            mockDrawings.mockResolvedValue({ status: 'ok', drawings: null });

            const res = await GET(
                signedRequest('AAPL', '2026-10-08', ANALYSIS_AT)
            );

            expect(res.status).toBe(200);
            expect(mockBuild).toHaveBeenCalledWith(
                expect.objectContaining({
                    drawings: null,
                    cacheControl: expect.stringContaining('immutable'),
                })
            );
        });

        it('행을 읽다 실패하면 작도 없는 이미지를 no-store로 낸다(불변 캐시 금지)', async () => {
            mockDrawings.mockResolvedValue({ status: 'failed' });

            const res = await GET(
                signedRequest('AAPL', '2026-10-08', ANALYSIS_AT)
            );

            expect(res.status).toBe(200);
            expect(mockBuild).toHaveBeenCalledWith(
                expect.objectContaining({
                    drawings: null,
                    cacheControl: 'no-store',
                })
            );
        });

        it('a를 바꾸면 서명이 맞지 않아 403이고 아무것도 읽지 않는다', async () => {
            const url = new URL(
                signedRequest('AAPL', '2026-10-08', ANALYSIS_AT).url
            );
            url.searchParams.set('a', String(ANALYSIS_AT.getTime() + 1));

            const res = await GET(new Request(url));

            expect(res.status).toBe(403);
            expect(mockDrawings).not.toHaveBeenCalled();
            expect(mockLoadBars).not.toHaveBeenCalled();
        });

        it('a를 떼어도 403이다(서명이 a를 묶는다)', async () => {
            const url = new URL(
                signedRequest('AAPL', '2026-10-08', ANALYSIS_AT).url
            );
            url.searchParams.delete('a');

            expect((await GET(new Request(url))).status).toBe(403);
        });

        it('a가 숫자 모양이 아니면 서명이 맞아도 403이다', async () => {
            const bad = 'abc';
            const url = new URL(signedRequest().url);
            url.searchParams.set('a', bad);
            url.searchParams.set(
                'sig',
                signReportValue(
                    SECRET,
                    'chart',
                    chartSignatureValue('AAPL', '2026-10-08', bad)
                )
            );

            const res = await GET(new Request(url));

            expect(res.status).toBe(403);
            expect(mockDrawings).not.toHaveBeenCalled();
        });
    });

    describe('a가 없는 옛 URL', () => {
        it('옛 서명(symbol:date)이 그대로 통하고 작도는 읽지 않는다', async () => {
            const legacy = signReportValue(SECRET, 'chart', 'AAPL:2026-10-08');
            const res = await GET(
                new Request(
                    `https://siglens.io/api/email-report/chart?s=AAPL&d=2026-10-08&sig=${legacy}`
                )
            );

            expect(res.status).toBe(200);
            expect(mockDrawings).not.toHaveBeenCalled();
            expect(mockBuild).toHaveBeenCalledWith(
                expect.objectContaining({ drawings: null })
            );
        });
    });
});
