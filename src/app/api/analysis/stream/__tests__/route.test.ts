/**
 * Route tests for POST /api/analysis/stream.
 *
 * Covers the four scenarios specified in Task 3b:
 * 1. Heartbeat timer reclaimed when client disconnects.
 * 2. Client abort does NOT propagate into core (shared dedupeInFlight work).
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

// resolveHoldingPositionBucket 경로를 테스트하려면 findByUserAndSymbol 와 getQuote를
// 호이스팅해서 개별 테스트에서 반환값을 제어할 수 있어야 한다.
const { mockFindByUserAndSymbol, mockGetQuote } = vi.hoisted(() => ({
    mockFindByUserAndSymbol: vi.fn(),
    mockGetQuote: vi.fn(),
}));

vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: vi.fn().mockReturnValue({
        getQuote: mockGetQuote,
    }),
}));

vi.mock('@/shared/api/market/sessionSpecFor', () => ({
    sessionSpecFor: vi.fn().mockReturnValue({}),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn().mockReturnValue({ db: {} }),
}));

vi.mock('@/entities/portfolio/api', () => ({
    // Vitest 4.x는 `new` 호출 시 arrow function 구현을 거부한다 — 일반 function을 사용한다.
    DrizzlePortfolioRepository: vi.fn().mockImplementation(function () {
        return { findByUserAndSymbol: mockFindByUserAndSymbol };
    }),
}));

// E2E 단락은 이 모듈을 동적 import한다 — prod 번들에서 스텁을 제외하기 위한 구조라
// 정적 import가 아니지만, vi.mock은 동적 import에도 동일하게 적용된다.
vi.mock('@/shared/api/e2eAnalysisStub', () => ({
    e2eCachedTechnical: vi.fn().mockReturnValue({
        status: 'cached',
        result: { headlineKo: 'E2E fixture' },
    }),
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

// Gap 7: tryAcquireReanalyzeCooldown 배선 — 재분석 쿨다운이 force를 파생한다.
// 이 mock이 없으면 Upstash 환경 변수가 없을 때 core 쿨다운이 fail-open({ok:true})으로
// 작동해 테스트가 항상 통과해 보이지만 실제 배선이 깨져도 알 수 없다.
// 쿨다운 해제는 **서버 전용**이라 core에서 직접 import한다 — 클라이언트가 호출
// 가능한 액션으로 열면 "해제 → 재요청" 루프로 쿨다운이 무력화된다.
vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    releaseReanalyzeCooldown: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/entities/analysis', () => ({
    tryAcquireReanalyzeCooldown: vi.fn().mockResolvedValue({ ok: true }),
}));

// --- Imports (after vi.mock declarations) ---

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '../route';
import { runAnalysis } from '../runAnalysisBridge';
import {
    resolveTierAndByok,
    resolveTierOnly,
    resolvePositionBucket,
    resolveReasoning,
} from '@/shared/lib/byokGate';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { DrizzlePortfolioRepository } from '@/entities/portfolio/api';
import { isBot } from '@/shared/api/isBot';
import { isE2E } from '@/shared/api/e2eEnv';
import { e2eCachedTechnical } from '@/shared/api/e2eAnalysisStub';
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
import { tryAcquireReanalyzeCooldown } from '@/entities/analysis';
import { releaseReanalyzeCooldown } from '@y0ngha/siglens-core';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveAssetClass';
import { getDescriptor } from '@/shared/config/marketProfile';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';

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
        // clearAllMocks는 호출 기록만 지우고 구현/반환값은 남긴다 — 테스트가 켜 둔
        // isE2E/isBot이 다음 테스트로 새는 걸 막기 위해 기본값을 매번 되돌린다.
        vi.mocked(isE2E).mockReturnValue(false);
        vi.mocked(isBot).mockReturnValue(false);
        vi.mocked(resolveTierOnly).mockResolvedValue('free' as never);
        vi.mocked(getCurrentUser).mockResolvedValue(null);
        vi.mocked(e2eCachedTechnical).mockReturnValue({
            status: 'cached',
            result: { headlineKo: 'E2E fixture' },
        } as never);
        // 기본값: 홀딩 없음, 시세 없음 — 기존 테스트는 tier='free'라 이 경로를 거치지 않는다.
        mockFindByUserAndSymbol.mockResolvedValue(null);
        mockGetQuote.mockResolvedValue(null);
        // vi.clearAllMocks()는 구현을 초기화하지 않는다 — 개별 테스트가 mock 반환값을
        // 변경했을 때 다음 테스트로 새지 않도록 기본값을 명시적으로 복원한다.
        vi.mocked(tryAcquireReanalyzeCooldown).mockResolvedValue({
            ok: true,
        } as never);
        vi.mocked(resolveReasoning).mockReturnValue(false);
        // vi.clearAllMocks()이 Vitest 4.x에서 mockImplementation도 초기화하는 경우를 대비해
        // DrizzlePortfolioRepository 구현을 명시적으로 재설정한다.
        // Vitest 4.x는 `new` 호출 시 arrow function 구현을 거부하므로 일반 function을 사용한다.
        vi.mocked(DrizzlePortfolioRepository).mockImplementation(function () {
            return { findByUserAndSymbol: mockFindByUserAndSymbol };
        } as never);
        // 마켓 프로필 관련 mock은 개별 테스트에서 오버라이드한 뒤 clearAllMocks만으론
        // 복원되지 않는다 — 명시적으로 기본값을 재설정한다.
        vi.mocked(resolveMarketProfile).mockResolvedValue('us-equity' as never);
        vi.mocked(getDescriptor).mockReturnValue({
            assetClass: 'equity',
        } as never);
        vi.mocked(sessionSpecFor).mockReturnValue({} as never);
        vi.mocked(getCachedMarketDataProvider).mockReturnValue({
            getQuote: mockGetQuote,
        } as never);
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
            // heartbeatStream은 영문 내부 오류를 제네릭 한국어 메시지로 마스킹한다.
            // 원문('LLM provider timeout')이 브라우저에 노출되지 않는 게 올바른 동작이다.
            expect(errorEvent).toContain('분석 중 오류가 발생했습니다');

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

    describe('client signal — core로 전파되지 않는다 (공유 작업 보호)', () => {
        it('core가 받는 signal은 클라이언트 것이 아니라 마감용이다', async () => {
            // core의 분석 실행은 dedupeInFlight로 공유된다 — 같은 캐시 키의 모든
            // 호출자가 하나의 promise를 함께 기다린다. 여기에 특정 클라이언트의
            // signal을 꽂으면 그 한 명이 이탈할 때 공유 promise가 reject되어
            // 같은 심볼을 기다리던 SEO prewarm 크론까지 실패한다. 게다가 캐시
            // write가 await 뒤에 있어 abort하면 캐시 워밍도 사라진다.
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

            ac.abort();
            const response = await POST(makeRequest(ac.signal));
            await collectSseEvents(response);

            // core는 signal을 받지만 그것은 withDeadline이 만든 작업별 signal이다.
            // 클라이언트가 이미 abort된 상태로 들어와도 그 상태가 전파되지 않는다.
            expect(capturedSignal).toBeInstanceOf(AbortSignal);
            expect(capturedSignal).not.toBe(ac.signal);
            expect(capturedSignal?.aborted).toBe(false);
        });

        it('클라이언트가 abort해도 core 호출은 그대로 완주한다', async () => {
            const ac = new AbortController();

            vi.mocked(runAnalysis).mockImplementation(
                (_symbol, _name, _tf, _force, _fmp, options) =>
                    Promise.resolve().then(() => {
                        // signal이 전달되지 않으므로 abort 여부를 알 수 없고,
                        // 작업은 정상 완료되어 캐시를 채운다.
                        if (options?.signal?.aborted) {
                            throw new DOMException('Aborted', 'AbortError');
                        }
                        return { status: 'miss_no_trigger' as const };
                    })
            );

            ac.abort();

            const response = await POST(makeRequest(ac.signal));
            const events = await collectSseEvents(response);

            expect(
                events.find(e => e.includes('event: error'))
            ).toBeUndefined();
            expect(events.some(e => e.includes('event: done'))).toBe(true);
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

            // overall 핸들러 시그니처: (symbol, companyName, timeframe, modelId, { force, reasoning }, signal)
            // reanalyze 없음 → cooldown=null → force=false, reasoning=undefined(params에 없음)
            expect(vi.mocked(runOverallAnalysisAction)).toHaveBeenCalledWith(
                'AAPL',
                'Apple',
                '1Day',
                'gemini-2.5-flash',
                { force: false, reasoning: undefined },
                expect.any(AbortSignal)
            );
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

            // fundamental 핸들러 시그니처: (symbol, modelId, reasoning, signal)
            expect(
                vi.mocked(runFundamentalAnalysisAction)
            ).toHaveBeenCalledWith(
                'AAPL',
                'gemini-2.5-flash',
                undefined,
                expect.any(AbortSignal)
            );
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

            // financials 핸들러 시그니처: (symbol, modelId, reasoning, signal)
            expect(vi.mocked(runFinancialsAnalysisAction)).toHaveBeenCalledWith(
                'AAPL',
                'gemini-2.5-flash',
                undefined,
                expect.any(AbortSignal)
            );
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

            // news 핸들러 시그니처: (symbol, companyName, modelId, reasoning, signal)
            expect(vi.mocked(submitNewsAnalysisAction)).toHaveBeenCalledWith(
                'AAPL',
                'Apple',
                'gemini-2.5-flash',
                undefined,
                expect.any(AbortSignal)
            );
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

            // marketNewsDigest 핸들러 시그니처: (category, signal)
            expect(
                vi.mocked(submitMarketNewsDigestAction)
            ).toHaveBeenCalledWith('general', expect.any(AbortSignal));
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

            // options 핸들러 시그니처: (symbol, companyName, expirationDate, modelId, reasoning, signal)
            expect(vi.mocked(submitOptionsAnalysisAction)).toHaveBeenCalledWith(
                'AAPL',
                'Apple',
                'nearest',
                'gemini-2.5-flash',
                undefined,
                expect.any(AbortSignal)
            );
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

            // congress 핸들러 시그니처: (symbol, modelId, reasoning, signal)
            expect(vi.mocked(runCongressTrendAction)).toHaveBeenCalledWith(
                'AAPL',
                'gemini-2.5-flash',
                undefined,
                expect.any(AbortSignal)
            );
        });

        it('briefing → submitMarketBriefingAction', async () => {
            vi.mocked(submitMarketBriefingAction).mockResolvedValue({
                briefing: null,
                botBlocked: false,
            } as never);

            const body = JSON.stringify({ type: 'briefing', params: {} });
            const response = await POST(makeRequest(undefined, body));
            await collectSseEvents(response);

            // briefing 핸들러 시그니처: (signal) — params 미사용
            expect(vi.mocked(submitMarketBriefingAction)).toHaveBeenCalledWith(
                expect.any(AbortSignal)
            );
        });

        it('macroBriefing → submitMacroBriefingAction', async () => {
            vi.mocked(submitMacroBriefingAction).mockResolvedValue({
                briefing: null,
                botBlocked: false,
            } as never);

            const body = JSON.stringify({ type: 'macroBriefing', params: {} });
            const response = await POST(makeRequest(undefined, body));
            await collectSseEvents(response);

            // macroBriefing 핸들러 시그니처: (signal) — params 미사용
            expect(vi.mocked(submitMacroBriefingAction)).toHaveBeenCalledWith(
                expect.any(AbortSignal)
            );
        });
    });

    /**
     * resolveHoldingPositionBucket — 내부 헬퍼의 네 가지 경로를 커버한다.
     *
     * 이 describe 블록에서는 `resolveTierOnly`를 'member'로 오버라이드하고
     * `getCurrentUser`를 실제 유저로 설정해, 기존 글로벌 mock이 'free'를 반환해
     * 조기 리턴하던 경로를 우회한다.
     *
     * positionBucket 검증은 `runAnalysis.mock.calls[0][5].positionBucket`으로
     * 직접 접근한다 — `expect.objectContaining({ positionBucket: undefined })`는
     * Vitest 4.x에서 undefined 비교가 불안정하고, `expect.anything()`은 undefined를
     * 매칭하지 않아(null/undefined 제외) fmpSymbol 위치에서 실패한다.
     */
    describe('resolveHoldingPositionBucket — 포지션 버킷 분기', () => {
        const MEMBER_BODY = JSON.stringify({
            type: 'technical',
            params: {
                symbol: 'AAPL',
                companyName: 'Apple Inc.',
                timeframe: '1Day',
            },
        });

        beforeEach(() => {
            vi.mocked(runAnalysis).mockResolvedValue({
                status: 'miss_no_trigger' as const,
            });
            // member tier + 실제 userId 기본값 — 각 테스트에서 필요시 오버라이드한다.
            vi.mocked(resolveTierOnly).mockResolvedValue('member' as never);
            vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as never);
        });

        it('userId === null 이면 홀딩을 조회하지 않고 positionBucket: undefined를 반환한다', async () => {
            // null userId → 조기 리턴, DB 조회 없음
            vi.mocked(getCurrentUser).mockResolvedValue(null);

            const response = await POST(makeRequest(undefined, MEMBER_BODY));
            await collectSseEvents(response);

            expect(mockFindByUserAndSymbol).not.toHaveBeenCalled();
            expect(vi.mocked(runAnalysis)).toHaveBeenCalledTimes(1);
            // positionBucket은 undefined — 직접 접근으로 검증
            const opts = vi.mocked(runAnalysis).mock.calls[0]?.[5] as Record<
                string,
                unknown
            >;
            expect(opts?.positionBucket).toBeUndefined();
        });

        it('member + 홀딩 없음 → DB 조회 후 positionBucket undefined, 시세 조회 스킵', async () => {
            mockFindByUserAndSymbol.mockResolvedValue(null); // 홀딩 없음

            const response = await POST(makeRequest(undefined, MEMBER_BODY));
            await collectSseEvents(response);

            expect(mockFindByUserAndSymbol).toHaveBeenCalledWith('u1', 'AAPL');
            expect(mockGetQuote).not.toHaveBeenCalled();
            expect(vi.mocked(runAnalysis)).toHaveBeenCalledTimes(1);
            const opts = vi.mocked(runAnalysis).mock.calls[0]?.[5] as Record<
                string,
                unknown
            >;
            expect(opts?.positionBucket).toBeUndefined();
        });

        it('member + 홀딩 있음 + 시세 조회 성공 → resolvePositionBucket 결과로 버킷 파생', async () => {
            mockFindByUserAndSymbol.mockResolvedValue({
                averagePrice: '100',
            } as never);
            mockGetQuote.mockResolvedValue({ price: 110 });
            // 이 테스트에서만 실제 버킷('profit')을 반환하도록 오버라이드한다.
            vi.mocked(resolvePositionBucket).mockReturnValue('profit' as never);

            const response = await POST(makeRequest(undefined, MEMBER_BODY));
            await collectSseEvents(response);

            expect(mockFindByUserAndSymbol).toHaveBeenCalledWith('u1', 'AAPL');
            expect(mockGetQuote).toHaveBeenCalled();
            expect(vi.mocked(runAnalysis)).toHaveBeenCalledWith(
                'AAPL',
                'Apple Inc.',
                '1Day',
                expect.any(Boolean),
                undefined,
                expect.objectContaining({ positionBucket: 'profit' })
            );
        });

        it('시세 조회가 null이면 currentPrice를 null로 넘긴다 — 홀딩이 있어도 버킷은 파생 못 함', async () => {
            mockFindByUserAndSymbol.mockResolvedValue({
                averagePrice: '100',
            } as never);
            mockGetQuote.mockResolvedValue(null);

            const response = await POST(makeRequest(undefined, MEMBER_BODY));
            await collectSseEvents(response);

            expect(vi.mocked(resolvePositionBucket)).toHaveBeenCalledWith(
                'member',
                100,
                null
            );
        });

        it('시세 조회가 5초를 넘기면 버킷 없이 진행한다 — heartbeat 이전 구간이라 늘어지면 ALB가 끊는다', async () => {
            mockFindByUserAndSymbol.mockResolvedValue({
                averagePrice: '100',
            } as never);
            // 영원히 안 끝나는 조회
            mockGetQuote.mockImplementation(() => new Promise(() => {}));

            const responsePromise = POST(makeRequest(undefined, MEMBER_BODY));
            await vi.advanceTimersByTimeAsync(5_000);
            const response = await responsePromise;
            await collectSseEvents(response);

            // 조회를 기다리다 멈추지 않고 currentPrice=null로 진행한다.
            expect(vi.mocked(resolvePositionBucket)).toHaveBeenCalledWith(
                'member',
                100,
                null
            );
            expect(vi.mocked(runAnalysis)).toHaveBeenCalledTimes(1);
        });

        it('fmpSymbol이 있으면 그 심볼로 시세를 조회한다 (없으면 symbol 폴백)', async () => {
            mockFindByUserAndSymbol.mockResolvedValue({
                averagePrice: '100',
            } as never);
            mockGetQuote.mockResolvedValue({ price: 110 });

            const response = await POST(
                makeRequest(
                    undefined,
                    JSON.stringify({
                        type: 'technical',
                        params: {
                            symbol: 'BTCUSD',
                            companyName: 'Bitcoin',
                            timeframe: '1Day',
                            fmpSymbol: 'BTCUSD.CC',
                        },
                    })
                )
            );
            await collectSseEvents(response);

            expect(mockGetQuote).toHaveBeenCalledWith('BTCUSD.CC');
        });

        it('포트폴리오 레포지토리가 throw하면 버킷을 undefined로 강등하고 분석은 정상 진행된다', async () => {
            mockFindByUserAndSymbol.mockRejectedValue(new Error('db down'));

            const response = await POST(makeRequest(undefined, MEMBER_BODY));
            await collectSseEvents(response);

            // 에러를 삼키고 분석은 계속된다 — 포지션 버킷 실패가 분석 전체를 막으면 안 된다.
            expect(vi.mocked(runAnalysis)).toHaveBeenCalledTimes(1);
            const opts = vi.mocked(runAnalysis).mock.calls[0]?.[5] as Record<
                string,
                unknown
            >;
            expect(opts?.positionBucket).toBeUndefined();
        });
    });

    /**
     * E2E 단락 — `isE2E()`가 true면 core를 전혀 호출하지 않고 fixture로 응답한다.
     * `personalized`는 버킷 계산 전에 반환하므로 평소처럼 파생할 수 없어,
     * `resolveHoldingPositionBucket`과 같은 조건(free 아님 + 홀딩 존재)으로 근사한다.
     */
    describe('E2E 단락', () => {
        beforeEach(() => {
            vi.mocked(isE2E).mockReturnValue(true);
        });

        it('봇 요청은 miss_no_trigger로 끝내고 core를 부르지 않는다', async () => {
            vi.mocked(isBot).mockReturnValue(true);

            const response = await POST(makeRequest());
            const events = await collectSseEvents(response);

            expect(events.some(e => e.includes('miss_no_trigger'))).toBe(true);
            expect(vi.mocked(runAnalysis)).not.toHaveBeenCalled();
            expect(vi.mocked(e2eCachedTechnical)).not.toHaveBeenCalled();
        });

        it('비봇 요청은 fixture를 반환하고 core를 부르지 않는다', async () => {
            const response = await POST(makeRequest());
            const events = await collectSseEvents(response);

            expect(vi.mocked(e2eCachedTechnical)).toHaveBeenCalledWith('free');
            expect(vi.mocked(runAnalysis)).not.toHaveBeenCalled();
            const doneEvent = events.find(e => e.includes('event: done'));
            expect(doneEvent).toContain('E2E fixture');
        });

        it('free tier는 홀딩을 조회하지 않고 personalized:false로 응답한다', async () => {
            const response = await POST(makeRequest());
            const events = await collectSseEvents(response);

            expect(mockFindByUserAndSymbol).not.toHaveBeenCalled();
            expect(events.find(e => e.includes('event: done'))).toContain(
                '"personalized":false'
            );
        });

        it('member + 홀딩 존재면 personalized:true로 응답한다 — 배지 배선 검증용', async () => {
            vi.mocked(resolveTierOnly).mockResolvedValue('member' as never);
            vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as never);
            mockFindByUserAndSymbol.mockResolvedValue({
                averagePrice: '100',
            } as never);

            const response = await POST(makeRequest());
            const events = await collectSseEvents(response);

            expect(mockFindByUserAndSymbol).toHaveBeenCalledWith('u1', 'AAPL');
            expect(events.find(e => e.includes('event: done'))).toContain(
                '"personalized":true'
            );
        });

        it('홀딩 조회가 throw해도 personalized:false로 강등하고 응답은 정상이다', async () => {
            vi.mocked(resolveTierOnly).mockResolvedValue('member' as never);
            vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as never);
            mockFindByUserAndSymbol.mockRejectedValue(new Error('db down'));

            const response = await POST(makeRequest());
            const events = await collectSseEvents(response);

            expect(events.find(e => e.includes('event: done'))).toContain(
                '"personalized":false'
            );
        });
    });

    describe('BYOK 게이트', () => {
        const MODEL_BODY = JSON.stringify({
            type: 'technical',
            params: {
                symbol: 'AAPL',
                companyName: 'Apple Inc.',
                timeframe: '1Day',
                modelId: 'claude-opus-5',
            },
        });

        it('blocked면 403이 아니라 SSE error 이벤트로 게이트 메시지를 전달한다', async () => {
            // 403을 쓰면 클라이언트가 게이트 메시지 대신 "분석 요청이 실패했습니다 (403)"을
            // 던지게 된다 — 그래서 의도적으로 200 + error 이벤트다.
            vi.mocked(resolveTierAndByok).mockResolvedValue({
                kind: 'blocked',
                error: {
                    code: 'model_not_allowed',
                    message: '이 모델은 사용할 수 없어요.',
                },
            } as never);

            const response = await POST(makeRequest(undefined, MODEL_BODY));

            expect(response.status).toBe(200);
            const events = await collectSseEvents(response);
            const errorEvent = events.find(e => e.includes('event: error'));
            expect(errorEvent).toContain('이 모델은 사용할 수 없어요.');
            expect(vi.mocked(runAnalysis)).not.toHaveBeenCalled();
        });

        it('userApiKey가 있으면 core 옵션에 전달한다', async () => {
            vi.mocked(runAnalysis).mockResolvedValue({
                status: 'miss_no_trigger' as const,
            });
            vi.mocked(resolveTierAndByok).mockResolvedValue({
                kind: 'ok',
                tier: 'member',
                userApiKey: 'sk-user',
            } as never);

            const response = await POST(makeRequest(undefined, MODEL_BODY));
            await collectSseEvents(response);

            const opts = vi.mocked(runAnalysis).mock.calls[0]?.[5] as Record<
                string,
                unknown
            >;
            expect(opts?.userApiKey).toBe('sk-user');
        });

        it('userApiKey가 없으면 옵션에 키 자체가 없다 — undefined로도 넣지 않는다', async () => {
            vi.mocked(runAnalysis).mockResolvedValue({
                status: 'miss_no_trigger' as const,
            });
            vi.mocked(resolveTierAndByok).mockResolvedValue({
                kind: 'ok',
                tier: 'member',
                userApiKey: undefined,
            } as never);

            const response = await POST(makeRequest(undefined, MODEL_BODY));
            await collectSseEvents(response);

            const opts = vi.mocked(runAnalysis).mock.calls[0]?.[5] as Record<
                string,
                unknown
            >;
            expect(Object.hasOwn(opts, 'userApiKey')).toBe(false);
        });
    });

    describe('예기치 못한 예외 → JSON 500', () => {
        it('technical 경로에서 스트림 생성 전에 throw하면 SSE가 아니라 JSON 500이다', async () => {
            vi.mocked(getCurrentUser).mockRejectedValue(new Error('auth down'));
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});

            const response = await POST(makeRequest());

            expect(response.status).toBe(500);
            expect(response.headers.get('Content-Type')).toContain(
                'application/json'
            );
            await expect(response.json()).resolves.toMatchObject({
                status: 'error',
            });

            errorSpy.mockRestore();
        });

        it('dispatch 핸들러가 동기적으로 throw해도 타이머를 회수하고 SSE error로 닫는다', async () => {
            // 동기 throw를 그대로 두면 Promise.race가 구성되지 않아 마감 타이머가
            // 남고, 5분 뒤 아무도 듣지 않는 reject가 unhandled rejection이 된다.
            vi.mocked(runOverallAnalysisAction).mockImplementation(() => {
                throw new Error('sync boom');
            });

            const response = await POST(
                makeRequest(
                    undefined,
                    JSON.stringify({
                        type: 'overall',
                        params: { symbol: 'AAPL' },
                    })
                )
            );

            expect(response.status).toBe(200);
            const events = await collectSseEvents(response);
            // heartbeatStream은 영문 내부 오류를 제네릭 한국어 메시지로 마스킹한다.
            // 동기 throw('sync boom')도 마스킹 대상이다.
            expect(events.find(e => e.includes('event: error'))).toContain(
                '분석 중 오류가 발생했습니다'
            );
            // 남은 타이머가 없다 — 있으면 이 시점에 pending timer가 잡힌다.
            expect(vi.getTimerCount()).toBe(0);
        });

        it('technical 외 타입도 params가 없으면 400이다', async () => {
            const response = await POST(
                makeRequest(undefined, JSON.stringify({ type: 'overall' }))
            );

            expect(response.status).toBe(400);
            expect(vi.mocked(runOverallAnalysisAction)).not.toHaveBeenCalled();
        });
    });

    describe('technical params 400 가드', () => {
        it('params 키가 아예 없으면 400', async () => {
            const response = await POST(
                makeRequest(undefined, JSON.stringify({ type: 'technical' }))
            );

            expect(response.status).toBe(400);
            expect(vi.mocked(runAnalysis)).not.toHaveBeenCalled();
        });

        it('params가 객체가 아니면 400', async () => {
            const response = await POST(
                makeRequest(
                    undefined,
                    JSON.stringify({ type: 'technical', params: 'AAPL' })
                )
            );

            expect(response.status).toBe(400);
            expect(vi.mocked(runAnalysis)).not.toHaveBeenCalled();
        });
    });

    /**
     * Gap 1: skipEnqueueIfMiss — 봇 감지가 LLM 비용 트리거를 제어한다.
     *
     * `skipEnqueueIfMiss: true`이면 core가 캐시 미스 시 LLM 큐를 건너뛴다.
     * 이 값이 잘못 배선되면 두 가지 재앙이 된다:
     * - 항상 true → 실제 사용자가 LLM 결과를 받지 못한다.
     * - 항상 false → 모든 크롤러 요청이 LLM 청구서를 태운다.
     */
    describe('skipEnqueueIfMiss — 봇 감지가 LLM 비용 트리거를 제어한다', () => {
        beforeEach(() => {
            vi.mocked(runAnalysis).mockResolvedValue({
                status: 'miss_no_trigger' as const,
            });
        });

        it('봇 요청이면 skipEnqueueIfMiss: true를 runAnalysis에 전달한다', async () => {
            vi.mocked(isBot).mockReturnValue(true);

            const response = await POST(makeRequest());
            await collectSseEvents(response);

            const opts = vi.mocked(runAnalysis).mock.calls[0]?.[5] as Record<
                string,
                unknown
            >;
            expect(opts?.skipEnqueueIfMiss).toBe(true);
        });

        it('봇 아닌 요청이면 skipEnqueueIfMiss: false를 runAnalysis에 전달한다', async () => {
            vi.mocked(isBot).mockReturnValue(false);

            const response = await POST(makeRequest());
            await collectSseEvents(response);

            const opts = vi.mocked(runAnalysis).mock.calls[0]?.[5] as Record<
                string,
                unknown
            >;
            expect(opts?.skipEnqueueIfMiss).toBe(false);
        });
    });

    /**
     * Gap 2: tierContext + resolveReasoning 배선.
     *
     * `tierContext`가 없으면 사용량 제한이 무음으로 해제된다.
     * `resolveReasoning` 대신 클라이언트 `reasoning`을 그대로 넣으면
     * 익명 사용자에게 유료 deep-thinking 모드가 공개 POST로 열린다.
     */
    describe('tierContext + resolveReasoning 배선', () => {
        beforeEach(() => {
            vi.mocked(runAnalysis).mockResolvedValue({
                status: 'miss_no_trigger' as const,
            });
        });

        it('modelId 없음 → resolveTierOnly 결과가 tierContext.tier에 배선된다', async () => {
            vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u7' } as never);
            vi.mocked(resolveTierOnly).mockResolvedValue('member' as never);

            const response = await POST(makeRequest());
            await collectSseEvents(response);

            const opts = vi.mocked(runAnalysis).mock.calls[0]?.[5] as Record<
                string,
                unknown
            >;
            expect(opts?.tierContext).toEqual({ userId: 'u7', tier: 'member' });
        });

        it('modelId 있음 → resolveTierAndByok 결과가 tierContext.tier에 배선된다', async () => {
            vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u7' } as never);
            vi.mocked(resolveTierAndByok).mockResolvedValue({
                kind: 'ok',
                tier: 'pro',
            } as never);

            const body = JSON.stringify({
                type: 'technical',
                params: {
                    symbol: 'AAPL',
                    companyName: 'Apple Inc.',
                    timeframe: '1Day',
                    modelId: 'claude-opus-4-7',
                },
            });

            const response = await POST(makeRequest(undefined, body));
            await collectSseEvents(response);

            const opts = vi.mocked(runAnalysis).mock.calls[0]?.[5] as Record<
                string,
                unknown
            >;
            expect(opts?.tierContext).toEqual({ userId: 'u7', tier: 'pro' });
        });

        it('resolveReasoning이 true를 반환하면 options.reasoning도 true다', async () => {
            // resolveReasoning이 true를 반환하도록 오버라이드 — beforeEach의 false와 구별.
            vi.mocked(resolveReasoning).mockReturnValue(true);
            vi.mocked(resolveTierOnly).mockResolvedValue('member' as never);

            const body = JSON.stringify({
                type: 'technical',
                params: {
                    symbol: 'AAPL',
                    companyName: 'Apple Inc.',
                    timeframe: '1Day',
                    reasoning: true,
                },
            });

            const response = await POST(makeRequest(undefined, body));
            await collectSseEvents(response);

            // resolveReasoning이 (tier, clientReasoning)으로 호출되었다.
            expect(vi.mocked(resolveReasoning)).toHaveBeenCalledWith(
                'member',
                true
            );
            const opts = vi.mocked(runAnalysis).mock.calls[0]?.[5] as Record<
                string,
                unknown
            >;
            expect(opts?.reasoning).toBe(true);
        });

        it('free tier에서 resolveReasoning이 false를 강제하면 options.reasoning도 false다', async () => {
            // 전역 beforeEach에서 resolveReasoning은 이미 false를 반환하도록 설정되어 있다.
            // free tier + 클라이언트 reasoning:true → resolveReasoning이 false로 재정의.
            vi.mocked(resolveTierOnly).mockResolvedValue('free' as never);

            const body = JSON.stringify({
                type: 'technical',
                params: {
                    symbol: 'AAPL',
                    companyName: 'Apple Inc.',
                    timeframe: '1Day',
                    reasoning: true,
                },
            });

            const response = await POST(makeRequest(undefined, body));
            await collectSseEvents(response);

            const opts = vi.mocked(runAnalysis).mock.calls[0]?.[5] as Record<
                string,
                unknown
            >;
            expect(opts?.reasoning).toBe(false);
        });
    });

    /**
     * Gap 3: assetClass + sessionSpec 라우팅.
     *
     * `assetClass: 'equity'`를 하드코딩하면 크립토 종목이 주식 시장 세션
     * 데이터로 분석되어 시세 제공자가 잘못된 마켓 hours 기준으로 시세를 돌려준다.
     */
    describe('assetClass + sessionSpec 라우팅', () => {
        beforeEach(() => {
            vi.mocked(runAnalysis).mockResolvedValue({
                status: 'miss_no_trigger' as const,
            });
        });

        it('crypto 프로필 → assetClass: "crypto"로 runAnalysis를 호출한다', async () => {
            vi.mocked(resolveMarketProfile).mockResolvedValue(
                'crypto' as never
            );
            vi.mocked(getDescriptor).mockReturnValue({
                assetClass: 'crypto',
            } as never);

            const body = JSON.stringify({
                type: 'technical',
                params: {
                    symbol: 'BTCUSD',
                    companyName: 'Bitcoin',
                    timeframe: '1Day',
                },
            });

            const response = await POST(makeRequest(undefined, body));
            await collectSseEvents(response);

            const opts = vi.mocked(runAnalysis).mock.calls[0]?.[5] as Record<
                string,
                unknown
            >;
            expect(opts?.assetClass).toBe('crypto');
        });

        it('us-equity 프로필 → assetClass: "equity"로 runAnalysis를 호출한다', async () => {
            // 기본 mock이 이미 'us-equity' + { assetClass: 'equity' }를 반환한다.
            const response = await POST(makeRequest());
            await collectSseEvents(response);

            const opts = vi.mocked(runAnalysis).mock.calls[0]?.[5] as Record<
                string,
                unknown
            >;
            expect(opts?.assetClass).toBe('equity');
        });

        it('sessionSpecFor 반환값이 getCachedMarketDataProvider에 전달된다', async () => {
            const MOCK_SESSION = { type: 'crypto-test' } as never;
            vi.mocked(sessionSpecFor).mockReturnValue(MOCK_SESSION);

            const response = await POST(makeRequest());
            await collectSseEvents(response);

            expect(vi.mocked(getCachedMarketDataProvider)).toHaveBeenCalledWith(
                MOCK_SESSION
            );
        });

        it('crypto 프로필 → sessionSpecFor에 "crypto"를 전달한다', async () => {
            vi.mocked(resolveMarketProfile).mockResolvedValue(
                'crypto' as never
            );
            vi.mocked(getDescriptor).mockReturnValue({
                assetClass: 'crypto',
            } as never);

            const response = await POST(makeRequest());
            await collectSseEvents(response);

            expect(vi.mocked(sessionSpecFor)).toHaveBeenCalledWith('crypto');
        });
    });

    /**
     * Gap 4: personalized — 실제(비E2E) 경로 badge-honesty 검증.
     *
     * `personalized`는 `positionBucket !== undefined`로 파생된다.
     * 홀딩이 존재해도 시세 조회가 실패하면 bucket을 파생할 수 없어 undefined가 된다.
     * "홀딩이 있다 = personalized"로 단락하면 배지가 거짓말을 한다.
     */
    describe('personalized — 실제(비E2E) 경로 badge-honesty 검증', () => {
        const MEMBER_BODY = JSON.stringify({
            type: 'technical',
            params: {
                symbol: 'AAPL',
                companyName: 'Apple Inc.',
                timeframe: '1Day',
            },
        });

        beforeEach(() => {
            vi.mocked(resolveTierOnly).mockResolvedValue('member' as never);
            vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as never);
            vi.mocked(runAnalysis).mockResolvedValue({
                status: 'cached',
                result: { headlineKo: '분석 완료' },
            } as never);
        });

        it('홀딩 있음 + 시세 조회 throw → positionBucket=undefined → personalized: false', async () => {
            /**
             * 이 케이스가 실패하면 "홀딩만 존재해도 personalized:true"가 되는 버그가 숨어 있다.
             * 재분석 배지가 실제 포지션 기반 맞춤 분석을 받지 않은 사용자에게 잘못 표시된다.
             */
            mockFindByUserAndSymbol.mockResolvedValue({
                averagePrice: '100',
            } as never);
            // 시세 조회 자체가 throw → resolveHoldingPositionBucket의 catch 블록이 잡아
            // undefined를 반환 → positionBucket=undefined → personalized=false.
            mockGetQuote.mockRejectedValue(new Error('quote service down'));

            const response = await POST(makeRequest(undefined, MEMBER_BODY));
            const events = await collectSseEvents(response);

            const doneEvent = events.find(e => e.includes('event: done'));
            expect(doneEvent).toBeDefined();
            // 홀딩이 있어도 시세 조회가 실패하면 personalized는 반드시 false여야 한다.
            expect(doneEvent).toContain('"personalized":false');
        });

        it('홀딩 있음 + 시세 조회 성공 → positionBucket이 파생되면 personalized: true', async () => {
            mockFindByUserAndSymbol.mockResolvedValue({
                averagePrice: '100',
            } as never);
            mockGetQuote.mockResolvedValue({ price: 110 });
            vi.mocked(resolvePositionBucket).mockReturnValue('profit' as never);

            const response = await POST(makeRequest(undefined, MEMBER_BODY));
            const events = await collectSseEvents(response);

            const doneEvent = events.find(e => e.includes('event: done'));
            expect(doneEvent).toContain('"personalized":true');
        });
    });

    /**
     * Gap 6: 프로토타입 오염 type 값 — Object.hasOwn 가드.
     *
     * `DISPATCH[body.type]`은 'toString'이나 'constructor'로 인덱싱하면
     * 프로토타입 상속 멤버를 반환해 `!handler` 가드를 통과한다. 400이어야 할
     * 입력이 500이나 예기치 못한 실행이 되는 걸 `Object.hasOwn`이 막는다.
     * 'unsupported'는 DISPATCH에 없어 undefined라 이 가드 없이도 400이지만,
     * 'toString'/'constructor'는 없는 경우에만 Object.hasOwn이 막는다.
     */
    describe('프로토타입 오염 type 값 — Object.hasOwn 가드', () => {
        it('type: "toString" → 400 (프로토타입 메서드가 핸들러로 새어나오지 않는다)', async () => {
            const response = await POST(
                makeRequest(
                    undefined,
                    JSON.stringify({ type: 'toString', params: {} })
                )
            );

            expect(response.status).toBe(400);
            // 어떤 액션도 호출되어선 안 된다.
            expect(vi.mocked(runOverallAnalysisAction)).not.toHaveBeenCalled();
        });

        it('type: "constructor" → 400 (프로토타입 멤버 오염 차단)', async () => {
            const response = await POST(
                makeRequest(
                    undefined,
                    JSON.stringify({ type: 'constructor', params: {} })
                )
            );

            expect(response.status).toBe(400);
            expect(vi.mocked(runOverallAnalysisAction)).not.toHaveBeenCalled();
        });
    });

    /**
     * Gap 7: force — 재분석 쿨다운으로 파생한다 (공개 라우트 비용 보호).
     *
     * 이 라우트는 인증 없는 공개 POST다. `force:true`를 클라이언트에서 직접
     * 받으면 누구나 캐시를 무한 우회해 서버 키로 LLM을 태울 수 있다.
     * 클라이언트는 `reanalyze` **의도**만 보내고, 서버가 Redis SET NX로
     * (symbol, timeframe)당 5분에 한 번만 쿨다운을 획득해 force를 파생한다.
     */
    describe('force — 재분석 쿨다운으로 파생한다 (공개 라우트 비용 보호)', () => {
        beforeEach(() => {
            vi.mocked(runAnalysis).mockResolvedValue({
                status: 'cached',
                result: {},
            } as never);
        });

        it('force 분석이 실패하면 서버가 쿨다운을 되돌린다', async () => {
            // 되돌리지 않으면 사용자는 아무 결과도 못 받은 채 5분을 기다린다.
            vi.mocked(tryAcquireReanalyzeCooldown).mockResolvedValue({
                ok: true,
            } as never);
            vi.mocked(runAnalysis).mockRejectedValue(new Error('LLM down'));

            const response = await POST(
                makeRequest(
                    undefined,
                    JSON.stringify({
                        type: 'technical',
                        params: {
                            symbol: 'AAPL',
                            companyName: 'Apple Inc.',
                            timeframe: '1Day',
                            reanalyze: true,
                        },
                    })
                )
            );
            await collectSseEvents(response);

            expect(vi.mocked(releaseReanalyzeCooldown)).toHaveBeenCalledWith(
                'AAPL',
                '1Day'
            );
        });

        it('force가 아닌 분석이 실패하면 쿨다운을 건드리지 않는다', async () => {
            vi.mocked(runAnalysis).mockRejectedValue(new Error('LLM down'));

            const response = await POST(makeRequest());
            await collectSseEvents(response);

            expect(vi.mocked(releaseReanalyzeCooldown)).not.toHaveBeenCalled();
        });

        it('reanalyze 없음 → tryAcquireReanalyzeCooldown 미호출, force: false', async () => {
            // reanalyze 의도 없이 일반 제출 — 쿨다운 획득이 일어나선 안 된다.
            const response = await POST(makeRequest());
            await collectSseEvents(response);

            expect(
                vi.mocked(tryAcquireReanalyzeCooldown)
            ).not.toHaveBeenCalled();
            // force 인자(4번째)가 false다.
            expect(vi.mocked(runAnalysis).mock.calls[0]?.[3]).toBe(false);
        });

        it('reanalyze: true + 획득 성공({ok:true}) → force: true로 runAnalysis를 호출한다', async () => {
            vi.mocked(tryAcquireReanalyzeCooldown).mockResolvedValue({
                ok: true,
            } as never);

            const body = JSON.stringify({
                type: 'technical',
                params: {
                    symbol: 'AAPL',
                    companyName: 'Apple Inc.',
                    timeframe: '1Day',
                    reanalyze: true,
                },
            });

            const response = await POST(makeRequest(undefined, body));
            await collectSseEvents(response);

            expect(vi.mocked(tryAcquireReanalyzeCooldown)).toHaveBeenCalledWith(
                'AAPL',
                '1Day'
            );
            // force 인자(4번째)가 true다.
            expect(vi.mocked(runAnalysis).mock.calls[0]?.[3]).toBe(true);
        });

        it('reanalyze: true + 획득 실패({ok:false}) → runAnalysis 미호출, done에 reanalyze_cooldown', async () => {
            vi.mocked(tryAcquireReanalyzeCooldown).mockResolvedValue({
                ok: false,
                remainingMs: 240_000,
            } as never);

            const body = JSON.stringify({
                type: 'technical',
                params: {
                    symbol: 'AAPL',
                    companyName: 'Apple Inc.',
                    timeframe: '1Day',
                    reanalyze: true,
                },
            });

            const response = await POST(makeRequest(undefined, body));
            const events = await collectSseEvents(response);

            // 쿨다운 중이므로 새 LLM 호출 없이 남은 시간을 알려준다.
            expect(vi.mocked(runAnalysis)).not.toHaveBeenCalled();
            const doneEvent = events.find(e => e.includes('event: done'));
            expect(doneEvent).toBeDefined();
            expect(doneEvent).toContain('reanalyze_cooldown');
            expect(doneEvent).toContain('240000');
        });
    });
});
