import { postAnalyze } from '@/infrastructure/market/analysisApi';
import type { AnalyzeVariables } from '@/infrastructure/market/analysisApi';

const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockVariables: AnalyzeVariables = {
    symbol: 'AAPL',
    bars: [
        {
            time: 1705312200,
            open: 100,
            high: 105,
            low: 99,
            close: 103,
            volume: 1000000,
        },
    ],
    indicators: {
        macd: [],
        bollinger: [],
        dmi: [],
        rsi: [],
        vwap: [],
        ma: {},
        ema: {},
    },
};

const mockAnalysisResponse = {
    summary: '테스트 분석 요약',
    trend: 'bullish' as const,
    signals: [],
    skillSignals: [],
    riskLevel: 'low' as const,
    keyLevels: { support: [], resistance: [] },
};

beforeEach(() => {
    mockFetch.mockReset();
});

describe('postAnalyze', () => {
    describe('정상 응답일 때', () => {
        it('AnalysisResponse를 반환한다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockAnalysisResponse,
            });

            const result = await postAnalyze(mockVariables);

            expect(result).toEqual(mockAnalysisResponse);
        });

        it('/api/analyze에 POST 요청을 보낸다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockAnalysisResponse,
            });

            await postAnalyze(mockVariables);

            const [url, init] = mockFetch.mock.calls[0] as [
                string,
                RequestInit,
            ];
            expect(url).toBe('/api/analyze');
            expect(init.method).toBe('POST');
        });

        it('Content-Type: application/json 헤더를 포함한다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockAnalysisResponse,
            });

            await postAnalyze(mockVariables);

            const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(
                (init.headers as Record<string, string>)['Content-Type']
            ).toBe('application/json');
        });

        it('symbol, bars, indicators를 JSON body로 전달한다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockAnalysisResponse,
            });

            await postAnalyze(mockVariables);

            const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
            const body = JSON.parse(init.body as string) as AnalyzeVariables;
            expect(body.symbol).toBe('AAPL');
            expect(body.bars).toHaveLength(1);
            expect(body.indicators).toBeDefined();
        });
    });

    describe('응답이 ok가 아닐 때', () => {
        it('에러를 던진다', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
            });

            await expect(postAnalyze(mockVariables)).rejects.toThrow(
                '분석 요청에 실패했습니다 (500)'
            );
        });
    });
});
