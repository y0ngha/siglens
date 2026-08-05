/**
 * Route tests for POST /api/analysis/stream.
 *
 * Covers the four scenarios specified in Task 3b:
 * 1. Heartbeat timer reclaimed when client disconnects.
 * 2. Abort signal propagates to runAnalysis.
 * 3. Error path emits `event: error` rather than hanging.
 * 4. `miss_no_trigger` result terminates cleanly.
 *
 * All auth/tier/market helpers are mocked to return valid defaults.
 * `runAnalysis` is mocked via its bridge module.
 */

// --- Module mocks (hoisted before imports) ---

vi.mock('@/entities/auth/lib/getCurrentUser', () => ({
    getCurrentUser: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/shared/api/isBot', () => ({
    isBot: vi.fn().mockReturnValue(false),
}));

vi.mock('@/shared/api/e2eEnv', () => ({
    isE2E: vi.fn().mockReturnValue(false),
}));

vi.mock('@/shared/lib/byokGate', () => ({
    resolveTierOnly: vi.fn().mockResolvedValue('free'),
    resolveTierAndByok: vi.fn(),
    resolveReasoning: vi.fn().mockReturnValue(false),
    resolvePositionBucket: vi.fn().mockReturnValue(undefined),
    buildGateError: vi
        .fn()
        .mockReturnValue({ code: 'unexpected_error', message: '' }),
}));

vi.mock('@/entities/ticker/lib/resolveAssetClass', () => ({
    resolveMarketProfile: vi.fn().mockResolvedValue('us-equity'),
}));

vi.mock('@/shared/config/marketProfile', () => ({
    getDescriptor: vi.fn().mockReturnValue({ assetClass: 'equity' }),
}));

vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: vi.fn().mockReturnValue({
        getQuote: vi.fn().mockResolvedValue(null),
    }),
}));

vi.mock('@/shared/api/market/sessionSpecFor', () => ({
    sessionSpecFor: vi.fn().mockReturnValue({}),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn().mockReturnValue({ db: {} }),
}));

vi.mock('@/entities/portfolio/api', () => ({
    DrizzlePortfolioRepository: vi.fn().mockImplementation(() => ({
        findByUserAndSymbol: vi.fn().mockResolvedValue(null),
    })),
}));

// runAnalysis is mocked via the bridge so we don't disturb the rest of @y0ngha/siglens-core.
vi.mock('../runAnalysisBridge', () => ({
    runAnalysis: vi.fn(),
}));

// DISPATCH action mocks — each entity action is mocked at its import path so
// the route's DISPATCH table picks up the mock (vi.mock is hoisted).
vi.mock('@/entities/analysis/actions', () => ({
    runOverallAnalysisAction: vi.fn(),
    runFundamentalAnalysisAction: vi.fn(),
    runFinancialsAnalysisAction: vi.fn(),
    runCongressTrendAction: vi.fn(),
}));
vi.mock('@/entities/news-article/actions', () => ({
    submitNewsAnalysisAction: vi.fn(),
}));
vi.mock('@/entities/market-news/actions/submitMarketNewsDigestAction', () => ({
    submitMarketNewsDigestAction: vi.fn(),
}));
vi.mock('@/entities/options-chain/actions', () => ({
    submitOptionsAnalysisAction: vi.fn(),
}));
vi.mock('@/entities/market-summary/actions/submitMarketBriefingAction', () => ({
    submitMarketBriefingAction: vi.fn(),
}));
vi.mock('@/entities/economy/actions/submitMacroBriefingAction', () => ({
    submitMacroBriefingAction: vi.fn(),
}));

// --- Imports (after vi.mock declarations) ---

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '../route';
import { runAnalysis } from '../runAnalysisBridge';
import { resolveTierAndByok } from '@/shared/lib/byokGate';
import { isBot } from '@/shared/api/isBot';
import { isE2E } from '@/shared/api/e2eEnv';
import {
    runOverallAnalysisAction,
    runFundamentalAnalysisAction,
    runFinancialsAnalysisAction,
    runCongressTrendAction,
} from '@/entities/analysis/actions';
import { submitNewsAnalysisAction } from '@/entities/news-article/actions';
import { submitMarketNewsDigestAction } from '@/entities/market-news/actions/submitMarketNewsDigestAction';
import { submitOptionsAnalysisAction } from '@/entities/options-chain/actions';
import { submitMarketBriefingAction } from '@/entities/market-summary/actions/submitMarketBriefingAction';
import { submitMacroBriefingAction } from '@/entities/economy/actions/submitMacroBriefingAction';

const decoder = new TextDecoder();

/** Minimal valid request body for a technical analysis call. */
const TECHNICAL_BODY = JSON.stringify({
    type: 'technical',
    params: {
        symbol: 'AAPL',
        companyName: 'Apple Inc.',
        timeframe: '1Day',
    },
});

/** Read all SSE event chunks from a Response until the stream closes. */
async function collectSseEvents(response: Response): Promise<string[]> {
    const reader = response.body!.getReader();
    const events: string[] = [];
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        events.push(decoder.decode(value));
    }
    return events;
}

/** Deferred promise for controlling when runAnalysis resolves/rejects in tests. */
function deferred<T>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (reason: unknown) => void;
} {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

/** Build a Request with the given signal and body. */
function makeRequest(
    signal?: AbortSignal,
    body: string = TECHNICAL_BODY
): Request {
    return new Request('http://localhost/api/analysis/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal,
    });
}

describe('POST /api/analysis/stream', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('miss_no_trigger — 스트림이 정상 종료된다', () => {
        it('runAnalysis가 miss_no_trigger를 반환하면 event: done으로 스트림을 닫는다', async () => {
            vi.mocked(runAnalysis).mockResolvedValue({
                status: 'miss_no_trigger',
            });

            const response = await POST(makeRequest());

            expect(response.status).toBe(200);
            expect(response.headers.get('Content-Type')).toContain(
                'text/event-stream'
            );

            const events = await collectSseEvents(response);

            expect(events.some(e => e.includes('event: open'))).toBe(true);
            const doneEvent = events.find(e => e.includes('event: done'));
            expect(doneEvent).toBeDefined();
            expect(doneEvent).toContain('miss_no_trigger');
        });
    });

    describe('error 경로 — 스트림이 hang되지 않는다', () => {
        it('runAnalysis가 reject되면 event: error를 emit하고 스트림을 닫는다', async () => {
            vi.mocked(runAnalysis).mockRejectedValue(
                new Error('LLM provider timeout')
            );

            const response = await POST(makeRequest());
            const events = await collectSseEvents(response);

            const errorEvent = events.find(e => e.includes('event: error'));
            expect(errorEvent).toBeDefined();
            expect(errorEvent).toContain('LLM provider timeout');

            // Stream must be closed (collectSseEvents only returns when done=true).
            // If it hung, the test would time out instead of reaching this assertion.
        });

        it('JSON 파싱 실패 시 400 JSON 응답을 반환한다', async () => {
            const response = await POST(makeRequest(undefined, 'not-json'));
            expect(response.status).toBe(400);
            const body = await response.json();
            expect(body.error).toContain('invalid JSON');
        });

        it('지원하지 않는 type 시 400 JSON 응답을 반환한다', async () => {
            const response = await POST(
                makeRequest(
                    undefined,
                    JSON.stringify({ type: 'unsupported', params: {} })
                )
            );
            expect(response.status).toBe(400);
        });
    });

    describe('abort — request.signal이 runAnalysis에 전파된다', () => {
        it('AbortController.abort() 시 runAnalysis에 전달된 signal이 aborted 상태다', async () => {
            const ac = new AbortController();

            vi.mocked(runAnalysis).mockImplementation(
                (_symbol, _name, _tf, _force, _fmp, options) =>
                    // Resolve after a tick so signal state is observable
                    Promise.resolve().then(() => {
                        if (options?.signal?.aborted) {
                            throw new DOMException('Aborted', 'AbortError');
                        }
                        return { status: 'miss_no_trigger' as const };
                    })
            );

            ac.abort();

            const response = await POST(makeRequest(ac.signal));
            const events = await collectSseEvents(response);

            // After abort the mock throws AbortError → heartbeatStream emits event: error
            const errorEvent = events.find(e => e.includes('event: error'));
            expect(errorEvent).toBeDefined();
            expect(errorEvent).toContain('Aborted');
        });

        it('runAnalysis 호출 시 options.signal이 AbortSignal로 전달된다', async () => {
            const ac = new AbortController();
            let capturedSignal: AbortSignal | undefined;

            vi.mocked(runAnalysis).mockImplementation(
                (_s, _c, _t, _f, _fp, options) => {
                    capturedSignal = options?.signal;
                    return Promise.resolve({
                        status: 'miss_no_trigger' as const,
                    });
                }
            );

            const response = await POST(makeRequest(ac.signal));
            await collectSseEvents(response);

            // The signal must be an AbortSignal (not undefined) so core can abort the LLM call.
            expect(capturedSignal).toBeInstanceOf(AbortSignal);
        });
    });

    describe('heartbeat 타이머 — 연결 끊김 시 회수된다', () => {
        it('응답 body를 cancel하면 clearInterval이 호출된다', async () => {
            // runAnalysis never resolves so the heartbeat timer stays active.
            const { promise } = deferred<{ status: 'miss_no_trigger' }>();
            vi.mocked(runAnalysis).mockReturnValue(promise);

            const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

            const response = await POST(makeRequest());
            const reader = response.body!.getReader();

            // Read the open event
            await reader.read();

            // Simulate client disconnect
            await reader.cancel();

            // The ReadableStream cancel() callback must have called clearInterval.
            expect(clearIntervalSpy).toHaveBeenCalled();
        });
    });

    describe('gate blocked (technical) — SSE error 이벤트로 게이트 메시지를 전달한다', () => {
        it('resolveTierAndByok가 blocked를 반환하면 event: error에 gate message를 담는다', async () => {
            vi.mocked(resolveTierAndByok).mockResolvedValue({
                kind: 'blocked',
                error: {
                    code: 'tier_premium_blocked',
                    message: '이 모델은 프리미엄 요금제에서만 사용 가능합니다.',
                },
            });

            const body = JSON.stringify({
                type: 'technical',
                params: {
                    symbol: 'AAPL',
                    companyName: 'Apple Inc.',
                    timeframe: '1Day',
                    modelId: 'claude-opus-4-5',
                },
            });

            const response = await POST(makeRequest(undefined, body));
            const events = await collectSseEvents(response);

            const errorEvent = events.find(e => e.includes('event: error'));
            expect(errorEvent).toBeDefined();
            expect(errorEvent).toContain('프리미엄');
        });
    });

    describe('E2E bot → miss_no_trigger (technical)', () => {
        it('E2E 환경에서 봇이면 heartbeatStream으로 miss_no_trigger를 흘린다', async () => {
            vi.mocked(isE2E).mockReturnValue(true);
            vi.mocked(isBot).mockReturnValue(true);

            const response = await POST(makeRequest());
            const events = await collectSseEvents(response);

            const doneEvent = events.find(e => e.includes('event: done'));
            expect(doneEvent).toBeDefined();
            expect(doneEvent).toContain('miss_no_trigger');
        });
    });

    describe('DISPATCH — 각 타입이 올바른 액션으로 위임된다', () => {
        /** 모든 DISPATCH 액션이 반환할 기본 성공 값. */
        const MOCK_RESULT = { status: 'cached' as const, result: {} };

        beforeEach(() => {
            vi.mocked(isE2E).mockReturnValue(false);
            vi.mocked(isBot).mockReturnValue(false);
        });

        it('overall → runOverallAnalysisAction', async () => {
            vi.mocked(runOverallAnalysisAction).mockResolvedValue(
                MOCK_RESULT as never
            );

            const body = JSON.stringify({
                type: 'overall',
                params: {
                    symbol: 'AAPL',
                    companyName: 'Apple',
                    timeframe: '1Day',
                    modelId: 'gemini-2.5-flash',
                },
            });
            const response = await POST(makeRequest(undefined, body));
            await collectSseEvents(response);

            expect(vi.mocked(runOverallAnalysisAction)).toHaveBeenCalledOnce();
        });

        it('fundamental → runFundamentalAnalysisAction', async () => {
            vi.mocked(runFundamentalAnalysisAction).mockResolvedValue(
                MOCK_RESULT as never
            );

            const body = JSON.stringify({
                type: 'fundamental',
                params: { symbol: 'AAPL', modelId: 'gemini-2.5-flash' },
            });
            const response = await POST(makeRequest(undefined, body));
            await collectSseEvents(response);

            expect(
                vi.mocked(runFundamentalAnalysisAction)
            ).toHaveBeenCalledOnce();
        });

        it('financials → runFinancialsAnalysisAction', async () => {
            vi.mocked(runFinancialsAnalysisAction).mockResolvedValue(
                MOCK_RESULT as never
            );

            const body = JSON.stringify({
                type: 'financials',
                params: { symbol: 'AAPL', modelId: 'gemini-2.5-flash' },
            });
            const response = await POST(makeRequest(undefined, body));
            await collectSseEvents(response);

            expect(
                vi.mocked(runFinancialsAnalysisAction)
            ).toHaveBeenCalledOnce();
        });

        it('news → submitNewsAnalysisAction', async () => {
            vi.mocked(submitNewsAnalysisAction).mockResolvedValue(
                MOCK_RESULT as never
            );

            const body = JSON.stringify({
                type: 'news',
                params: {
                    symbol: 'AAPL',
                    companyName: 'Apple',
                    modelId: 'gemini-2.5-flash',
                },
            });
            const response = await POST(makeRequest(undefined, body));
            await collectSseEvents(response);

            expect(vi.mocked(submitNewsAnalysisAction)).toHaveBeenCalledOnce();
        });

        it('marketNewsDigest → submitMarketNewsDigestAction', async () => {
            vi.mocked(submitMarketNewsDigestAction).mockResolvedValue(
                MOCK_RESULT as never
            );

            const body = JSON.stringify({
                type: 'marketNewsDigest',
                params: { category: 'general' },
            });
            const response = await POST(makeRequest(undefined, body));
            await collectSseEvents(response);

            expect(
                vi.mocked(submitMarketNewsDigestAction)
            ).toHaveBeenCalledOnce();
        });

        it('options → submitOptionsAnalysisAction', async () => {
            vi.mocked(submitOptionsAnalysisAction).mockResolvedValue(
                MOCK_RESULT as never
            );

            const body = JSON.stringify({
                type: 'options',
                params: {
                    symbol: 'AAPL',
                    companyName: 'Apple',
                    expirationDate: 'nearest',
                    modelId: 'gemini-2.5-flash',
                },
            });
            const response = await POST(makeRequest(undefined, body));
            await collectSseEvents(response);

            expect(
                vi.mocked(submitOptionsAnalysisAction)
            ).toHaveBeenCalledOnce();
        });

        it('congress → runCongressTrendAction', async () => {
            vi.mocked(runCongressTrendAction).mockResolvedValue(
                MOCK_RESULT as never
            );

            const body = JSON.stringify({
                type: 'congress',
                params: { symbol: 'AAPL', modelId: 'gemini-2.5-flash' },
            });
            const response = await POST(makeRequest(undefined, body));
            await collectSseEvents(response);

            expect(vi.mocked(runCongressTrendAction)).toHaveBeenCalledOnce();
        });

        it('briefing → submitMarketBriefingAction', async () => {
            vi.mocked(submitMarketBriefingAction).mockResolvedValue({
                briefing: null,
                botBlocked: false,
            } as never);

            const body = JSON.stringify({ type: 'briefing', params: {} });
            const response = await POST(makeRequest(undefined, body));
            await collectSseEvents(response);

            expect(
                vi.mocked(submitMarketBriefingAction)
            ).toHaveBeenCalledOnce();
        });

        it('macroBriefing → submitMacroBriefingAction', async () => {
            vi.mocked(submitMacroBriefingAction).mockResolvedValue({
                briefing: null,
                botBlocked: false,
            } as never);

            const body = JSON.stringify({ type: 'macroBriefing', params: {} });
            const response = await POST(makeRequest(undefined, body));
            await collectSseEvents(response);

            expect(vi.mocked(submitMacroBriefingAction)).toHaveBeenCalledOnce();
        });
    });
});
