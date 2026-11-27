import { vi } from 'vitest';
import { earlierProjection } from '../../fixtures/sinceEarlier';
import { fakes, repos, world } from '../boundary';
import { overallAnalysis, storedTechnicalAnalysis } from '../fixtures';
import {
    CLOCKS,
    listKrStock,
    listUsStock,
    SYMBOLS,
    type GoldenCase,
} from '../goldenCase';

/**
 * `get_cached_analysis`·`run_fresh_analysis` — 저장된 실제 기술 분석(`storedAnalyses.json`)을 캐시·생성 결과로 쓴다.
 * `sinceEarlier`(이전 턴 분석과의 차이)는 에이전트 실행기에만 이전 분석을 넘겨 고정한다.
 */

const ANALYZED_LAST_NIGHT = '2026-11-17T21:40:00.000Z';

const EARLIER = [
    {
        symbol: SYMBOLS.us,
        generatedAt: '2026-11-09T22:05:00.000Z',
        analysis: earlierProjection(),
        seq: 14,
    },
];

const technicalHit = (which: 0 | 1, analyzedAt: string) => ({
    result: storedTechnicalAnalysis(which, analyzedAt),
    lockedInfoDepth: [],
});

const snapshotRow = (
    tab: string,
    content: unknown,
    plain: string | null,
    generatedAt: string
) => ({
    symbol: SYMBOLS.us,
    tab,
    locale: 'ko',
    content,
    plain,
    model: 'deepseek-v4.1-flash',
    generatedAt: new Date(generatedAt),
    firstGeneratedAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date(generatedAt),
});

/** 프리웜 스냅샷 본문을 상한(에이전트 16,000자) 너머로 키운 것 — 공개 API(32,000자)는 자르지 않는다. */
const oversizedTechnicalContent = () => {
    const base = storedTechnicalAnalysis(1, '2026-11-18T06:00:00.000Z');
    return {
        ...base,
        summary: `${String(base.summary)}\n\n${'추가 해설: 이동평균 배열과 거래량 흐름을 구간별로 다시 짚습니다. '.repeat(260)}`,
    };
};

export const cachedAnalysisCases: GoldenCase[] = [
    {
        tool: 'get_cached_analysis',
        name: 'member-technical-hit-full-size',
        now: CLOCKS.usOpen,
        args: { symbol: SYMBOLS.us, tab: 'technical' },
        arrange: () => {
            listUsStock();
            fakes.peekAnalysisCache.mockResolvedValue(
                technicalHit(0, ANALYZED_LAST_NIGHT)
            );
        },
    },
    {
        tool: 'get_cached_analysis',
        name: 'member-technical-hit-since-earlier',
        now: CLOCKS.usClosed,
        args: { symbol: SYMBOLS.us, tab: 'technical', timeframe: '1Day' },
        earlierAnalyses: EARLIER,
        arrange: () => {
            listUsStock();
            fakes.peekAnalysisCache.mockResolvedValue(
                technicalHit(1, ANALYZED_LAST_NIGHT)
            );
        },
    },
    {
        tool: 'get_cached_analysis',
        name: 'member-overall-miss-technical-substitute',
        now: CLOCKS.usOpen,
        args: { symbol: SYMBOLS.us, tab: 'overall' },
        arrange: () => {
            listUsStock();
            fakes.peekAnalysisCache.mockResolvedValue(
                technicalHit(0, '2026-11-18T14:50:00.000Z')
            );
            repos.seoSnapshot.methods.findBySymbol.mockResolvedValue([
                snapshotRow(
                    'overall',
                    overallAnalysis('2026-11-16T09:00:00.000Z'),
                    null,
                    '2026-11-16T09:00:00.000Z'
                ),
            ]);
        },
    },
    {
        tool: 'get_cached_analysis',
        name: 'member-overall-redis-hit',
        now: CLOCKS.weekend,
        caller: 'pro',
        args: { symbol: SYMBOLS.us, tab: 'overall' },
        arrange: () => {
            listUsStock();
            fakes.peekOverallAnalysisCache.mockImplementation(
                async (...args: unknown[]) =>
                    args[4] === true
                        ? overallAnalysis('2026-11-20T23:10:00.000Z')
                        : overallAnalysis('2026-11-19T23:10:00.000Z')
            );
        },
    },
    {
        tool: 'get_cached_analysis',
        name: 'guest-technical-oversized-snapshot-truncation',
        now: CLOCKS.usOpen,
        caller: 'guest',
        args: { symbol: SYMBOLS.us, tab: 'technical' },
        arrange: () => {
            listUsStock();
            repos.seoSnapshot.methods.findBySymbol.mockResolvedValue([
                snapshotRow(
                    'technical',
                    oversizedTechnicalContent(),
                    '쉬운 말 요약입니다.',
                    '2026-11-18T06:00:00.000Z'
                ),
            ]);
        },
    },
    {
        tool: 'get_cached_analysis',
        name: 'free-overall-history-digest',
        now: CLOCKS.usClosed,
        caller: 'free',
        args: { symbol: SYMBOLS.us, tab: 'overall' },
        arrange: () => {
            listUsStock();
            repos.analysisHistory.methods.findRecentForPrompt.mockResolvedValue(
                [
                    {
                        generatedAt: new Date('2026-11-12T22:00:00.000Z'),
                        trend: 'bullish',
                        riskLevel: 'medium',
                        entryPrices: [238.5, 240.2],
                        stopLoss: 231.75,
                        takeProfitPrices: [252, 261.4],
                    },
                ]
            );
        },
    },
    {
        tool: 'get_cached_analysis',
        name: 'guest-news-tab-not-found',
        now: CLOCKS.krSession,
        caller: 'guest',
        args: { symbol: SYMBOLS.kr, tab: 'news' },
        arrange: () => listKrStock(),
    },
];

const NEWS_RESULT = {
    currentDriverKo: '수주 공시와 증설 발표가 매수세를 이끌고 있습니다.',
    keyEventsKo: ['대형 수주 공시', '2공장 증설', '외국인 순매수 전환'],
    upcomingEventsKo: ['다음 달 실적 발표'],
    overallSentiment: 'bullish',
    analyzedAt: '2026-11-19T01:40:00.000Z',
};

const OPTIONS_RESULT = {
    summary:
        '가까운 만기의 콜 미결제약정이 250달러에 몰려 있고, 내재변동성은 실적 전 수준으로 올라와 있습니다.',
    perExpiration: [
        {
            expirationDate: '2026-11-20',
            commentary: '250 콜 미결제약정 집중, 단기 상단 의식',
            tone: 'cautious',
        },
        {
            expirationDate: '2026-11-27',
            commentary: '풋/콜 비율 0.71로 콜 우위',
            tone: 'bullish',
        },
        {
            expirationDate: '2026-12-18',
            commentary: '내재변동성 34%로 평균 대비 높음',
            tone: 'neutral',
        },
    ],
    signals: Array.from({ length: 12 }, (_, i) => ({
        kind: (['bullish', 'bearish', 'neutral', 'volatility'] as const)[i % 4],
        message: `신호 ${i + 1}: 행사가 ${235 + i * 5} 부근 거래량 변화`,
    })),
    analyzedAt: '2026-11-18T15:00:00.000Z',
};

export const freshAnalysisCases: GoldenCase[] = [
    {
        tool: 'run_fresh_analysis',
        name: 'member-technical-done-since-earlier',
        now: CLOCKS.usOpen,
        args: { symbol: SYMBOLS.us, kind: 'technical' },
        earlierAnalyses: EARLIER,
        arrange: () => {
            listUsStock();
            const result = storedTechnicalAnalysis(0, CLOCKS.usOpen);
            fakes.runAnalysis.mockResolvedValue({
                status: 'done',
                result,
                unfilteredResult: result,
            });
        },
    },
    {
        tool: 'run_fresh_analysis',
        name: 'member-overall-limit-public-fallback',
        now: CLOCKS.usClosed,
        args: { symbol: SYMBOLS.us, kind: 'overall' },
        arrange: () => {
            listUsStock();
            fakes.runOverallAnalysisAction.mockResolvedValue({
                status: 'error',
                error: { code: 'analysis_limit_exceeded' },
            });
            repos.seoSnapshot.methods.findBySymbol.mockResolvedValue([
                snapshotRow(
                    'overall',
                    overallAnalysis('2026-11-16T09:00:00.000Z'),
                    '종합 쉬운 말 요약',
                    '2026-11-16T09:00:00.000Z'
                ),
            ]);
        },
    },
    {
        tool: 'run_fresh_analysis',
        name: 'guest-kr-news-refreshes-symbol',
        now: CLOCKS.krSession,
        caller: 'guest',
        args: { symbol: SYMBOLS.kr, kind: 'news' },
        arrange: () => {
            listKrStock();
            fakes.submitNewsAnalysisAction.mockResolvedValue({
                status: 'done',
                result: NEWS_RESULT,
            });
        },
    },
    {
        tool: 'run_fresh_analysis',
        name: 'options-cached-signals-capped',
        now: CLOCKS.usOpen,
        args: { symbol: SYMBOLS.us, kind: 'options' },
        arrange: () => {
            listUsStock();
            fakes.submitOptionsAnalysisAction.mockResolvedValue({
                status: 'cached',
                result: OPTIONS_RESULT,
            });
        },
    },
    {
        tool: 'run_fresh_analysis',
        name: 'technical-provider-error',
        now: CLOCKS.weekend,
        caller: 'free',
        args: { symbol: SYMBOLS.us, kind: 'technical', timeframe: '1Week' },
        arrange: () => {
            listUsStock();
            fakes.runAnalysis.mockResolvedValue({
                status: 'error',
                code: 'ai_server_unstable',
            });
        },
    },
    {
        tool: 'run_fresh_analysis',
        name: 'e2e-fake-mode-held-placeholder',
        now: CLOCKS.usOpen,
        args: { symbol: SYMBOLS.us, kind: 'technical' },
        arrange: () => {
            world.e2eFake = true;
            vi.stubEnv('E2E_FAKE_FRESH_ANALYSIS_MS', '1');
        },
    },
    {
        tool: 'run_fresh_analysis',
        name: 'unknown-kind-invalid-args',
        now: CLOCKS.weekend,
        args: { symbol: SYMBOLS.us, kind: 'sentiment' },
    },
];
