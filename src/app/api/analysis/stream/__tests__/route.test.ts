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

/**
 * 디스크립터는 **실물 상수**를 쓴다. 손으로 채운 부분 객체를 `as never`로
 * 통과시키면 타입 검사가 무력화돼, 라우트가 필드를 하나 더 읽기 시작한 순간
 * 런타임에서 터진다 — 이 PR이 고친 결함이 정확히 그것이었다(`{ assetClass }`만
 * 있던 mock 4개가 `priceFormat`을 읽자 죽었다). 실물을 쓰면
 * `MarketProfileDescriptor`에 필드가 늘어도 자동으로 따라온다.
 */
const { US_EQUITY, KR_EQUITY, CRYPTO } = await vi.hoisted(async () => {
    const [us, kr, crypto] = await Promise.all([
        import('@/shared/config/marketProfile/usEquity'),
        import('@/shared/config/marketProfile/krEquity'),
        import('@/shared/config/marketProfile/crypto'),
    ]);
    return {
        US_EQUITY: us.US_EQUITY_DESCRIPTOR,
        KR_EQUITY: kr.KR_EQUITY_DESCRIPTOR,
        CRYPTO: crypto.CRYPTO_DESCRIPTOR,
    };
});

vi.mock('@/shared/config/marketProfile', () => ({
    getDescriptor: vi.fn().mockReturnValue(US_EQUITY),
    /**
     * 통화 판별은 실물을 쓴다.
     *
     * 예전에는 `getDescriptor`만 모킹하고 라우트가 `getDescriptor(...).priceFormat.currency`를
     * 부르게 두었는데, mock에 `priceFormat`이 없어 **매번 TypeError → catch → 'USD' 폴백**이었다.
     * `'USD'`를 단언하는 테스트가 실패 경로만으로 통과했고, `'KRW'`는 한 번도 생성된 적이 없다
     * (감사 실측 M1). 심볼 형상만 보는 순수 함수이므로 모킹할 이유가 없다.
     *
     * 지금은 라우트가 디스크립터에서 통화를 읽지만(PR #779), 이 항목은 남겨 둔다 —
     * 같은 모듈을 쓰는 다른 호출자가 생겼을 때 mock이 조용히 undefined를 돌려주는
     * 상태로 돌아가지 않게 한다.
     */
    currencyForSymbol: (symbol: string) =>
        /\.(KS|KQ)$/.test(symbol) ? 'KRW' : 'USD',
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

vi.mock('@/entities/analysis-plain', () => ({
    rewriteToPlainLanguage: vi.fn(async () => '쉽게 쓴 분석문입니다.'),
    /**
     * 현재가 조회는 이 라우트의 관심사가 아니다 — "payload에 숫자가 있으면
     * 조회하지 않는다"는 분기는 `entities/analysis-plain/lib/currentPrice.ts`로
     * 옮겨졌고, 그쪽 단위 테스트가 실물로 검증한다. 여기서 실물을 쓰면 시세
     * 프로바이더까지 끌려온다.
     */
    resolveCurrentPrice: vi.fn(async () => undefined),
}));
vi.mock('@/entities/analysis', () => ({
    tryAcquireReanalyzeCooldown: vi.fn().mockResolvedValue({ ok: true }),
}));

// --- Imports (after vi.mock declarations) ---

import { TEST_STREAM_MESSAGES } from '@/shared/test-utils/streamMessagesFixture';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import jaMessages from '../../../../../../messages/ja.json';
import koMessages from '../../../../../../messages/ko.json';
import { POST } from '../route';
import { runAnalysis } from '../runAnalysisBridge';
import {
    resolveTierAndByok,
    resolveTierOnly,
    resolvePositionBucket,
    resolveReasoning,
} from '@/shared/lib/byokGate';
import { rewriteToPlainLanguage } from '@/entities/analysis-plain';
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
import {
    MAX_CONCURRENT_ANALYSIS_STREAMS,
    incrementActiveStreams,
    __resetActiveStreamsForTests,
} from '@/shared/lib/sse/activeStreams';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveAssetClass';
import { getDescriptor } from '@/shared/config/marketProfile';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { runAnalysisStream } from '@/shared/hooks/useAnalysisStream';

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
    body: string = TECHNICAL_BODY,
    locale?: string
): Request {
    return new Request('http://localhost/api/analysis/stream', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(locale ? { 'x-siglens-locale': locale } : {}),
        },
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
        vi.mocked(getDescriptor).mockReturnValue(US_EQUITY);
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
            // `compress: true` 이후 Next 압축 미들웨어가 이 라우트에도 붙는다 —
            // `no-transform`을 보고서만 빠진다. 이 조각이 사라지면 SSE가 gzip
            // 버퍼에 갇혀 실시간성이 죽는다(CF 설정 정리 중 지우기 쉬운 자리).
            expect(response.headers.get('Cache-Control')).toContain(
                'no-transform'
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
                'ko',
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
                'ko',
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
                'ko',
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
                'ko',
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
            ).toHaveBeenCalledWith('general', 'ko', expect.any(AbortSignal));
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

            // options 핸들러 시그니처:
            // (symbol, companyName, expirationDate, modelId, reasoning, signal, cacheOnly)
            expect(vi.mocked(submitOptionsAnalysisAction)).toHaveBeenCalledWith(
                'AAPL',
                'Apple',
                'nearest',
                'gemini-2.5-flash',
                'ko',
                undefined,
                expect.any(AbortSignal),
                undefined
            );
        });

        /**
         * `cacheOnly`는 OI가 stale할 때 클라이언트가 켠다 — 캐시에 있으면 읽고
         * 없으면 새 분석을 만들지 않는다. 라우트가 이 파라미터를 흘리지 않으면
         * 열화된 입력으로 분석이 새로 돌아간다.
         */
        it('options → cacheOnly 파라미터를 액션으로 전달한다', async () => {
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
                    cacheOnly: true,
                },
            });
            const response = await POST(makeRequest(undefined, body));
            await collectSseEvents(response);

            expect(vi.mocked(submitOptionsAnalysisAction)).toHaveBeenCalledWith(
                'AAPL',
                'Apple',
                'nearest',
                'gemini-2.5-flash',
                'ko',
                undefined,
                expect.any(AbortSignal),
                true
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

            // congress 핸들러 시그니처: (symbol, modelId, locale, reasoning, signal)
            expect(vi.mocked(runCongressTrendAction)).toHaveBeenCalledWith(
                'AAPL',
                'gemini-2.5-flash',
                'ko',
                undefined,
                expect.any(AbortSignal)
            );
        });

        /**
         * 헤더 로케일이 **액션 인자까지** 도달하는지 본다.
         *
         * 스위트의 다른 로케일 단언은 전부 `'ko'`(= `DEFAULT_LOCALE`)라
         * `resolveRequestLocale`을 상수 반환으로 바꿔도 통과했다(감사 실증:
         * 10,516개 전부 초록). 비-기본 로케일이어야만 반증이 된다.
         */
        it.each(['ja', 'en', 'zh'])(
            'x-siglens-locale: %s가 액션 인자로 전달된다',
            async locale => {
                vi.mocked(runCongressTrendAction).mockResolvedValue(
                    MOCK_RESULT as never
                );

                const body = JSON.stringify({
                    type: 'congress',
                    params: { symbol: 'AAPL', modelId: 'gemini-2.5-flash' },
                });
                const response = await POST(
                    makeRequest(undefined, body, locale)
                );
                await collectSseEvents(response);

                expect(vi.mocked(runCongressTrendAction)).toHaveBeenCalledWith(
                    'AAPL',
                    'gemini-2.5-flash',
                    locale,
                    undefined,
                    expect.any(AbortSignal)
                );
            }
        );

        it('신뢰 경계: 알 수 없는 로케일 헤더는 기본값으로 떨어진다', async () => {
            vi.mocked(runCongressTrendAction).mockResolvedValue(
                MOCK_RESULT as never
            );

            const body = JSON.stringify({
                type: 'congress',
                params: { symbol: 'AAPL', modelId: 'gemini-2.5-flash' },
            });
            await collectSseEvents(
                await POST(makeRequest(undefined, body, '../../etc/passwd'))
            );

            expect(vi.mocked(runCongressTrendAction)).toHaveBeenCalledWith(
                'AAPL',
                'gemini-2.5-flash',
                'ko',
                undefined,
                expect.any(AbortSignal)
            );
        });

        /**
         * `technical`은 DISPATCH 테이블을 타지 않고 **자기 분기에서** 로케일을
         * 따로 푼다(`route.ts:608`). 그래서 DISPATCH 쪽 테스트가 아무리 촘촘해도
         * 이 분기는 비어 있었다 — 실증: 그 줄을 `DEFAULT_LOCALE`로 고정해도
         * 89개 테스트가 전부 통과했다. 최다 트래픽 경로다.
         */
        it('technical 분기의 로케일이 게이트까지 도달한다', async () => {
            vi.mocked(runAnalysis).mockResolvedValue(MOCK_RESULT as never);
            // `modelId`가 있어야 BYOK 게이트를 탄다 — 없으면 로케일을 받지 않는
            // `resolveTierOnly` 쪽으로 빠져 로케일이 관측되지 않는다.
            vi.mocked(resolveTierAndByok).mockResolvedValue({
                kind: 'allowed',
                tier: 'pro',
                userApiKey: undefined,
            } as never);

            const body = JSON.stringify({
                type: 'technical',
                params: {
                    symbol: 'AAPL',
                    companyName: 'Apple Inc.',
                    timeframe: '1Day',
                    modelId: 'gemini-2.5-flash',
                },
            });
            await collectSseEvents(
                await POST(makeRequest(undefined, body, 'ja'))
            );

            expect(vi.mocked(resolveTierAndByok)).toHaveBeenCalledWith(
                null,
                'gemini-2.5-flash',
                'ja'
            );
        });

        /**
         * 로케일이 core까지 닿는지 본다.
         *
         * 사후 번역 계층이 사라진 뒤로 산출물 언어는 **core가 대상 언어로 직접
         * 쓰는 것**에만 달려 있다. 로케일이 core 호출에서 빠지면 그 축만 조용히
         * 한국어로 나오고 에러는 하나도 안 난다 — 예전 `technical`이 정확히 그
         * 상태였다(실증: 두 호출부를 `DEFAULT_LOCALE`로 고정해도 108개 통과).
         */
        it.each([
            ['technical', TECHNICAL_BODY],
            [
                'congress',
                JSON.stringify({
                    type: 'congress',
                    params: { symbol: 'AAPL', modelId: 'gemini-2.5-flash' },
                }),
            ],
        ])('%s: 요청 로케일이 core까지 그대로 내려간다', async (name, body) => {
            /*
             * 사후 번역 계층이 사라지면서, 산출물 언어는 **core가 대상
             * 언어로 직접 쓰는 것**에 전적으로 달려 있다. 로케일이 core
             * 호출에서 누락되면 그 축만 조용히 한국어로 나온다 — 예전
             * `technical`이 정확히 그 상태였다.
             */
            vi.mocked(runAnalysis).mockResolvedValue(MOCK_RESULT as never);
            vi.mocked(runCongressTrendAction).mockResolvedValue(
                MOCK_RESULT as never
            );

            await collectSseEvents(
                await POST(makeRequest(undefined, body, 'ja'))
            );

            if (name === 'technical') {
                const opts = vi
                    .mocked(runAnalysis)
                    .mock.calls.find(c => c[0] === 'AAPL')?.[5] as
                    | Record<string, unknown>
                    | undefined;
                expect(opts?.locale).toBe('ja');
                return;
            }
            // 위치 인자다 — (symbol, modelId, locale, reasoning, signal).
            expect(vi.mocked(runCongressTrendAction).mock.calls[0]?.[2]).toBe(
                'ja'
            );
        });

        /**
         * core가 만든 `timeframe_not_allowed`는 영어 문장이라 **한국어 사용자에게도
         * 영어가 나갔다**. 라운드 7이 카탈로그로 갈아끼웠는데 그 블록을 통째로
         * 지워도 111개 테스트가 통과했다 — 즉 수정이 반증 불가였다.
         */
        it('timeframe_not_allowed 문구를 요청 로케일 카탈로그로 갈아끼운다', async () => {
            vi.mocked(runCongressTrendAction).mockResolvedValue({
                status: 'error',
                error: {
                    code: 'timeframe_not_allowed',
                    message: 'This timeframe is not available for your tier.',
                },
            } as never);

            const events = await collectSseEvents(
                await POST(
                    makeRequest(
                        undefined,
                        JSON.stringify({
                            type: 'congress',
                            params: {
                                symbol: 'AAPL',
                                modelId: 'gemini-2.5-flash',
                            },
                        }),
                        'ja'
                    )
                )
            );

            const payload = events.join('');
            expect(payload).toContain(
                jaMessages.app.api.stream.timeframeNotAllowed
            );
            expect(payload).not.toContain('not available for your tier');
        });

        it('briefing → submitMarketBriefingAction', async () => {
            vi.mocked(submitMarketBriefingAction).mockResolvedValue({
                briefing: null,
                botBlocked: false,
            } as never);

            const body = JSON.stringify({ type: 'briefing', params: {} });
            const response = await POST(makeRequest(undefined, body));
            await collectSseEvents(response);

            // briefing 핸들러 시그니처: (scope, signal).
            // scope는 클라이언트가 보낸 문자열을 그대로 넘기고, 액션이
            // `isDashboardScopeId`로 검증한다 — 라우트와 액션 양쪽에 검증을 두면
            // 규칙이 갈린다.
            expect(vi.mocked(submitMarketBriefingAction)).toHaveBeenCalledWith(
                undefined,
                expect.any(AbortSignal)
            );
        });

        /**
         * 클라의 scope가 서버로 건너오는 **유일한** 지점이다. 여기서 잘못된 키를
         * 읽으면(`params.category` 등) 값이 조용히 `undefined`가 되어 액션 기본값
         * `'us'`로 떨어진다 — `/market/kr`이 한국어 제목 아래 미국 브리핑을
         * 보여주고, 스택 어디에도 신호가 없다. 위 케이스는 body에 scope가 없어
         * 어떤 키를 읽어도 통과하므로 이 케이스가 필요하다.
         */
        it('briefing params.scope를 액션에 그대로 넘긴다', async () => {
            vi.mocked(submitMarketBriefingAction).mockResolvedValue({
                briefing: null,
                botBlocked: false,
            } as never);

            const body = JSON.stringify({
                type: 'briefing',
                params: { scope: 'kr' },
            });
            const response = await POST(makeRequest(undefined, body));
            await collectSseEvents(response);

            expect(vi.mocked(submitMarketBriefingAction)).toHaveBeenCalledWith(
                'kr',
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
            /**
             * payload에 숫자를 둔다. 평이화도 현재가가 없을 때만 시세를 부르므로,
             * 숫자가 없으면 이 단언이 그쪽 호출까지 잡아 두 목적이 뒤섞인다.
             * 여기서 검증하려는 것은 **포지션 버킷용** 조회가 없다는 것이다.
             */
            vi.mocked(runAnalysis).mockResolvedValue({
                status: 'cached',
                result: { summary: 's', price: 100 },
                lockedInfoDepth: [],
            } as never);

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
            /**
             * payload에 숫자를 둬 평이화 쪽 시세 조회를 막는다. 그쪽도 같은 5초
             * 상한을 쓰므로, 두 조회가 겹치면 이 테스트가 검증하려는 **포지션 버킷**
             * 경로의 타임아웃이 아니라 둘의 합을 재게 된다.
             */
            vi.mocked(runAnalysis).mockResolvedValue({
                status: 'cached',
                result: { summary: 's', price: 100 },
                lockedInfoDepth: [],
            } as never);

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
            // 게이트 문구는 이제 **코드로** 번역한다(`gateMessage`) — mock의
            // `message`는 서버 로그용으로만 남고 화면에는 카탈로그 값이 나간다.
            // 그래서 `AnalysisGateErrorCode`에 실재하는 코드를 써야 한다.
            vi.mocked(resolveTierAndByok).mockResolvedValue({
                kind: 'blocked',
                error: {
                    code: 'tier_premium_blocked',
                    message: '(로그용 원문)',
                },
            } as never);

            // Task 7: console spy — 게이트 거부는 가용성 장애가 아니라 정상 동작이라
            // outage log(`[analysis-stream] failed:`)를 남기면 안 된다.
            // 대신 구별용 경고(`[analysis-stream] gate-denied:`)만 남긴다.
            const warnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});

            const response = await POST(makeRequest(undefined, MODEL_BODY));

            expect(response.status).toBe(200);
            const events = await collectSseEvents(response);
            const errorEvent = events.find(e => e.includes('event: error'));
            expect(errorEvent).toContain(
                koMessages.shared.lib.byokGate.tier_premium_blocked
            );
            expect(vi.mocked(runAnalysis)).not.toHaveBeenCalled();

            // Task 7: 게이트 거부는 outage 알람 로그를 남기면 안 된다.
            // `[analysis-stream] failed:` 는 CloudWatch 메트릭 필터가 의존하는
            // 유일한 분석 전면 장애 신호다 — 정상 거부가 섞이면 알람이 무뎌진다.
            const failedLogs = errorSpy.mock.calls.filter(args =>
                String(args[0]).includes('[analysis-stream] failed:')
            );
            expect(failedLogs).toHaveLength(0);

            // 게이트 거부는 별도 경고로 구분 로깅한다.
            const gateDeniedWarning = warnSpy.mock.calls.find(args =>
                String(args[0]).includes('[analysis-stream] gate-denied:')
            );
            expect(gateDeniedWarning).toBeDefined();
            expect(gateDeniedWarning?.[1]).toBe('tier_premium_blocked');

            warnSpy.mockRestore();
            errorSpy.mockRestore();
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

    describe('동시성 상한', () => {
        it('in-flight 스트림이 상한에 도달하면 503으로 거절한다', async () => {
            // 공개 라우트라 심볼만 바꾸면 캐시·dedupe를 모두 비켜 간다. 인스턴스
            // 레벨에서 막지 않으면 루프 하나가 t4g.medium을 고갈시킨다.
            __resetActiveStreamsForTests();
            for (let i = 0; i < MAX_CONCURRENT_ANALYSIS_STREAMS; i++) {
                incrementActiveStreams();
            }

            const response = await POST(makeRequest());

            expect(response.status).toBe(503);
            expect(response.headers.get('Retry-After')).toBe('30');
            expect(vi.mocked(runAnalysis)).not.toHaveBeenCalled();

            __resetActiveStreamsForTests();
        });

        it('상한 미만이면 정상 처리한다', async () => {
            __resetActiveStreamsForTests();
            vi.mocked(runAnalysis).mockResolvedValue({
                status: 'miss_no_trigger',
            });

            const response = await POST(makeRequest());
            await collectSseEvents(response);

            expect(response.status).toBe(200);
        });

        /**
         * Task 3: 봇 ×2 천장 — technical + DISPATCH(overall) 경로 양쪽.
         *
         * 봇(isBot=true)은 `MAX_CONCURRENT_ANALYSIS_STREAMS`의 두 배 천장을 사용한다.
         * 사람 트래픽이 상한을 채운 상태에서도 Googlebot이 503을 받으면 robots.txt에
         * 이 경로를 열어 둔 의미가 사라진다.
         *
         * 이 테스트가 없으면 `canAcceptAnalysisStream(skipEnqueueIfMiss)` 호출에서
         * `skipEnqueueIfMiss` 인자가 제거돼 상수 `false`로 대체되어도 기존 사람 경계
         * 테스트는 여전히 녹색이 된다.
         */
        describe('봇 ×2 천장 (Task 3)', () => {
            afterEach(() => {
                __resetActiveStreamsForTests();
            });

            it('technical 경로: MAX 포화 + 봇 요청 → 200 (봇 천장 미도달)', async () => {
                __resetActiveStreamsForTests();
                for (let i = 0; i < MAX_CONCURRENT_ANALYSIS_STREAMS; i++) {
                    incrementActiveStreams();
                }
                vi.mocked(isBot).mockReturnValue(true);
                vi.mocked(runAnalysis).mockResolvedValue({
                    status: 'miss_no_trigger' as const,
                });

                const response = await POST(makeRequest());
                await collectSseEvents(response);

                // 봇 천장(MAX × 2)에 아직 여유가 있으므로 통과해야 한다.
                expect(response.status).toBe(200);
            });

            it('technical 경로: MAX×2 포화 + 봇 요청 → 503 (봇 천장 초과)', async () => {
                __resetActiveStreamsForTests();
                for (let i = 0; i < MAX_CONCURRENT_ANALYSIS_STREAMS * 2; i++) {
                    incrementActiveStreams();
                }
                vi.mocked(isBot).mockReturnValue(true);

                const response = await POST(makeRequest());

                expect(response.status).toBe(503);
                expect(response.headers.get('Retry-After')).toBe('30');
                expect(vi.mocked(runAnalysis)).not.toHaveBeenCalled();
            });

            it('DISPATCH 경로(overall): MAX 포화 + 봇 요청 → 200 (봇 천장 미도달)', async () => {
                __resetActiveStreamsForTests();
                for (let i = 0; i < MAX_CONCURRENT_ANALYSIS_STREAMS; i++) {
                    incrementActiveStreams();
                }
                vi.mocked(isBot).mockReturnValue(true);
                vi.mocked(runOverallAnalysisAction).mockResolvedValue({
                    status: 'cached',
                    result: {},
                } as never);

                const response = await POST(
                    makeRequest(
                        undefined,
                        JSON.stringify({
                            type: 'overall',
                            params: {
                                symbol: 'AAPL',
                                companyName: 'Apple',
                                timeframe: '1Day',
                                modelId: 'gemini-2.5-flash',
                            },
                        })
                    )
                );
                await collectSseEvents(response);

                // DISPATCH도 `canAcceptAnalysisStream(isBot(request.headers))`로 같은 봇 천장을 써야 한다.
                expect(response.status).toBe(200);
            });

            it('DISPATCH 경로(overall): MAX×2 포화 + 봇 요청 → 503 (봇 천장 초과)', async () => {
                __resetActiveStreamsForTests();
                for (let i = 0; i < MAX_CONCURRENT_ANALYSIS_STREAMS * 2; i++) {
                    incrementActiveStreams();
                }
                vi.mocked(isBot).mockReturnValue(true);

                const response = await POST(
                    makeRequest(
                        undefined,
                        JSON.stringify({
                            type: 'overall',
                            params: {
                                symbol: 'AAPL',
                                companyName: 'Apple',
                                timeframe: '1Day',
                                modelId: 'gemini-2.5-flash',
                            },
                        })
                    )
                );

                expect(response.status).toBe(503);
                expect(response.headers.get('Retry-After')).toBe('30');
                expect(
                    vi.mocked(runOverallAnalysisAction)
                ).not.toHaveBeenCalled();
            });
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
            vi.mocked(getDescriptor).mockReturnValue(CRYPTO);

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

        /**
         * core는 심볼에서 통화를 추론하지 않는다 — 거래소 프로파일을 아는 이
         * 라우트가 넘겨야 한다. 넘기지 않으면 core가 `'USD'`로 기본값을 잡아
         * 원화 종목의 손절·목표가가 `$121980.70`처럼 달러 기호와 원화에 없는
         * 소수 정밀도를 달고 나온다(코퍼스 실측: 원화 종목 20건 중 19건).
         */
        /**
         * 호출을 **심볼로** 고른다 — `mock.calls[0]`으로 잡으면 안 된다.
         * 앞 테스트가 남긴 in-flight 요청이 `clearAllMocks()` 이후에 뒤늦게
         * `runAnalysis`를 부르면 그 호출이 `[0]`을 차지해, 이 테스트가 남의
         * 호출(us-equity, USD)을 검사하게 된다. 실제로 전체 스위트에서만
         * `expected 'USD' to be 'KRW'`로 깨졌고 단일 파일 실행은 통과했다.
         */
        function currencyOfCallFor(symbol: string): unknown {
            const call = vi
                .mocked(runAnalysis)
                .mock.calls.find(c => c[0] === symbol);
            expect(
                call,
                `runAnalysis가 ${symbol}로 호출되지 않았다`
            ).toBeDefined();
            return (call?.[5] as Record<string, unknown>).currency;
        }

        it('kr-equity 프로필 → currency: "KRW"로 runAnalysis를 호출한다', async () => {
            vi.mocked(resolveMarketProfile).mockResolvedValue(
                'kr-equity' as never
            );
            vi.mocked(getDescriptor).mockReturnValue(KR_EQUITY);

            const body = JSON.stringify({
                type: 'technical',
                params: {
                    symbol: '005930.KS',
                    companyName: '삼성전자',
                    timeframe: '1Day',
                },
            });

            const response = await POST(makeRequest(undefined, body));
            await collectSseEvents(response);

            expect(currencyOfCallFor('005930.KS')).toBe('KRW');
        });

        it('us-equity 프로필 → currency: "USD"로 runAnalysis를 호출한다', async () => {
            const response = await POST(makeRequest());
            await collectSseEvents(response);

            expect(currencyOfCallFor('AAPL')).toBe('USD');
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
            vi.mocked(getDescriptor).mockReturnValue(CRYPTO);

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

        /**
         * Task 10: 클라이언트가 `force: true`를 본문에 직접 보내도 무시된다.
         *
         * 이 라우트는 인증 없는 공개 POST다. 본문의 `force: true`를 그대로 믿으면
         * 누구나 캐시를 우회해 서버 키로 LLM을 태울 수 있다. 서버는 `reanalyze`
         * 의도만 읽고, force는 쿨다운 획득 결과로 파생한다. 본문에 `force: true`가
         * 있어도 `reanalyze`가 없으면 쿨다운 획득이 없어 force=false다.
         *
         * 회귀 예시: `cooldown?.ok === true || params.force === true` 같은 OR 조건이
         * 추가되면 이 테스트가 실패한다.
         */
        it('본문에 force: true가 있어도 reanalyze 의도 없으면 runAnalysis는 force=false로 호출된다', async () => {
            const body = JSON.stringify({
                type: 'technical',
                params: {
                    symbol: 'AAPL',
                    companyName: 'Apple Inc.',
                    timeframe: '1Day',
                    force: true, // 클라이언트가 직접 보내는 force — 무시되어야 한다
                },
            });

            const response = await POST(makeRequest(undefined, body));
            await collectSseEvents(response);

            // reanalyze가 없으면 쿨다운 획득 자체가 없다.
            expect(
                vi.mocked(tryAcquireReanalyzeCooldown)
            ).not.toHaveBeenCalled();
            // force 인자(4번째)가 false — 본문의 force:true는 무시된다.
            expect(vi.mocked(runAnalysis).mock.calls[0]?.[3]).toBe(false);
        });
    });

    /**
     * Task 2 & 3: overall 타입 — 쿨다운 획득·namespace·실패 시 해제.
     *
     * technical 분기의 쿨다운 테스트와 대칭 구조. overall이 별도 namespace
     * (`${timeframe}:overall`)를 쓰지 않으면 technical 탭 재분석이 overall 탭
     * 재분석을 막아 한쪽이 조용히 캐시로 강등된다.
     */
    describe('overall 타입 — 쿨다운 namespace + 실패 시 서버 해제', () => {
        const OVERALL_BODY = JSON.stringify({
            type: 'overall',
            params: {
                symbol: 'AAPL',
                companyName: 'Apple',
                timeframe: '1Day',
                modelId: 'gemini-2.5-flash',
                reanalyze: true,
            },
        });

        beforeEach(() => {
            vi.mocked(runOverallAnalysisAction).mockResolvedValue({
                status: 'cached',
                result: {},
            } as never);
        });

        // Task 3a: reanalyze: true → tryAcquireReanalyzeCooldown이 올바른 namespace로 호출된다.
        it('reanalyze: true → tryAcquireReanalyzeCooldown을 "AAPL", "1Day:overall"로 호출한다', async () => {
            // `:overall` suffix가 없으면 technical과 namespace를 공유해
            // 하나의 재분석이 다른 탭 재분석을 막는다.
            vi.mocked(tryAcquireReanalyzeCooldown).mockResolvedValue({
                ok: true,
            } as never);

            const response = await POST(makeRequest(undefined, OVERALL_BODY));
            await collectSseEvents(response);

            expect(vi.mocked(tryAcquireReanalyzeCooldown)).toHaveBeenCalledWith(
                'AAPL',
                '1Day:overall'
            );
        });

        // Task 3b: 획득 성공 → runOverallAnalysisAction에 force: true가 전달된다.
        it('쿨다운 획득 성공 → runOverallAnalysisAction이 force: true로 호출된다', async () => {
            vi.mocked(tryAcquireReanalyzeCooldown).mockResolvedValue({
                ok: true,
            } as never);

            const response = await POST(makeRequest(undefined, OVERALL_BODY));
            await collectSseEvents(response);

            expect(vi.mocked(runOverallAnalysisAction)).toHaveBeenCalledWith(
                'AAPL',
                'Apple',
                '1Day',
                'gemini-2.5-flash',
                'ko',
                expect.objectContaining({ force: true }),
                expect.any(AbortSignal)
            );
        });

        // Task 3c: 획득 실패 → runOverallAnalysisAction 미호출, done에 reanalyze_cooldown.
        it('쿨다운 획득 실패({ok:false}) → runOverallAnalysisAction 미호출, done에 reanalyze_cooldown', async () => {
            vi.mocked(tryAcquireReanalyzeCooldown).mockResolvedValue({
                ok: false,
                remainingMs: 180_000,
            } as never);

            const response = await POST(makeRequest(undefined, OVERALL_BODY));
            const events = await collectSseEvents(response);

            expect(vi.mocked(runOverallAnalysisAction)).not.toHaveBeenCalled();
            const doneEvent = events.find(e => e.includes('event: done'));
            expect(doneEvent).toBeDefined();
            expect(doneEvent).toContain('reanalyze_cooldown');
            expect(doneEvent).toContain('180000');
        });

        // Task 3d: reanalyze 없음 → tryAcquireReanalyzeCooldown 미호출, force: false.
        it('reanalyze 없음 → tryAcquireReanalyzeCooldown 미호출, force: false', async () => {
            const bodyNoReanalyze = JSON.stringify({
                type: 'overall',
                params: {
                    symbol: 'AAPL',
                    companyName: 'Apple',
                    timeframe: '1Day',
                    modelId: 'gemini-2.5-flash',
                    // reanalyze 없음
                },
            });

            const response = await POST(
                makeRequest(undefined, bodyNoReanalyze)
            );
            await collectSseEvents(response);

            expect(
                vi.mocked(tryAcquireReanalyzeCooldown)
            ).not.toHaveBeenCalled();
            expect(vi.mocked(runOverallAnalysisAction)).toHaveBeenCalledWith(
                'AAPL',
                'Apple',
                '1Day',
                'gemini-2.5-flash',
                'ko',
                expect.objectContaining({ force: false }),
                expect.any(AbortSignal)
            );
        });

        // Task 2: overall 실패 시 서버가 쿨다운을 해제한다.
        it('overall 분석 실패 시 서버가 획득했던 쿨다운을 해제한다', async () => {
            // 해제하지 않으면 사용자는 아무 결과도 못 받은 채 5분간 재분석이 막힌다.
            vi.mocked(tryAcquireReanalyzeCooldown).mockResolvedValue({
                ok: true,
            } as never);
            vi.mocked(runOverallAnalysisAction).mockRejectedValue(
                new Error('LLM down')
            );

            const response = await POST(makeRequest(undefined, OVERALL_BODY));
            await collectSseEvents(response);

            // `:overall` namespace로 해제가 호출되어야 한다.
            expect(vi.mocked(releaseReanalyzeCooldown)).toHaveBeenCalledWith(
                'AAPL',
                '1Day:overall'
            );
        });

        /**
         * Task 6: overall의 `if (cooldown?.ok === true)` 가드 — 거짓 분기.
         *
         * reanalyze 의도 없이 overall 분석이 실패하면 cooldown = undefined이므로
         * `cooldown?.ok === true`가 false다 — `releaseReanalyzeCooldown`을 호출해선 안 된다.
         *
         * 이 분기가 없으면 reanalyze 없는 요청도 오류 시 releaseReanalyzeCooldown을 호출해
         * 다른 사용자의 쿨다운 슬롯을 조용히 해제할 수 있다.
         *
         * 기존 실패 테스트는 `reanalyze: true` + `cooldown.ok: true` 조합만 커버한다
         * (OVERALL_BODY에 reanalyze가 있다). 이 테스트가 없으면 false 분기를 삭제하는
         * 회귀가 기존 테스트에서 잡히지 않는다.
         */
        it('reanalyze 없는 overall 분석이 실패해도 releaseReanalyzeCooldown을 호출하지 않는다 (Task 6)', async () => {
            vi.mocked(runOverallAnalysisAction).mockRejectedValue(
                new Error('LLM down')
            );

            const bodyNoReanalyze = JSON.stringify({
                type: 'overall',
                params: {
                    symbol: 'AAPL',
                    companyName: 'Apple',
                    timeframe: '1Day',
                    modelId: 'gemini-2.5-flash',
                    // reanalyze 없음 → cooldown = undefined → cooldown?.ok = undefined ≠ true
                },
            });

            const response = await POST(
                makeRequest(undefined, bodyNoReanalyze)
            );
            await collectSseEvents(response);

            // cooldown이 없으므로 해제도 없어야 한다.
            expect(vi.mocked(releaseReanalyzeCooldown)).not.toHaveBeenCalled();
        });
    });

    /**
     * Task 4: 동시성 상한 검사가 게이팅 await 이후에 있다.
     *
     * 검사를 진입부(게이팅 await 이전)로 올리면 게이팅이 진행되는 동안 몰려든 요청이
     * 전부 같은 카운트(증가 전)를 읽어 모두 통과한다 — 이것이 이 상한이 막으려는 버스트다.
     *
     * 이 테스트는 게이팅 await(getCurrentUser)가 pending인 동안 카운터를 포화시켜,
     * 요청이 resolve된 후 503을 받음을 검증한다. 검사를 진입부로 호이스트하면 이 테스트가
     * 실패한다(요청이 getCurrentUser 전에 카운터를 읽어 카운트가 0일 때 통과하기 때문).
     */
    describe('동시성 상한 — 검사가 게이팅 await 이후에 있다', () => {
        it('getCurrentUser가 pending인 동안 카운터를 채우면 resolve 후 503을 반환한다', async () => {
            __resetActiveStreamsForTests();

            // getCurrentUser가 deferred promise를 반환 — 게이팅 await를 제어한다.
            let resolveUser!: () => void;
            const userDeferred = new Promise<null>(resolve => {
                resolveUser = () => resolve(null);
            });
            vi.mocked(getCurrentUser).mockReturnValue(
                userDeferred as unknown as ReturnType<typeof getCurrentUser>
            );

            // 요청을 시작하되 아직 resolve하지 않는다.
            const responsePromise = POST(makeRequest());

            // getCurrentUser가 pending인 동안 카운터를 상한까지 채운다.
            for (let i = 0; i < MAX_CONCURRENT_ANALYSIS_STREAMS; i++) {
                incrementActiveStreams();
            }

            // getCurrentUser를 resolve → 게이팅이 진행됨 → 상한 검사 도달.
            resolveUser();
            const response = await responsePromise;

            expect(response.status).toBe(503);
            expect(vi.mocked(runAnalysis)).not.toHaveBeenCalled();

            __resetActiveStreamsForTests();
        });
    });

    /**
     * Task 5: 동시성 상한 거절 시 획득한 쿨다운을 해제한다.
     *
     * 사용자가 재분석 중 버스트가 발생해 503을 받으면, 그 재분석을 위해 획득한
     * 쿨다운을 서버가 되돌려야 한다 — 안 하면 LLM 결과도 못 받고 5분을 기다린다.
     */
    describe('동시성 상한 거절 + 쿨다운 해제 (reanalyze=true)', () => {
        it('cap 포화 + reanalyze: true → 503이고 releaseReanalyzeCooldown이 호출된다', async () => {
            __resetActiveStreamsForTests();
            for (let i = 0; i < MAX_CONCURRENT_ANALYSIS_STREAMS; i++) {
                incrementActiveStreams();
            }

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

            expect(response.status).toBe(503);
            // 획득한 쿨다운을 되돌려야 한다.
            expect(vi.mocked(releaseReanalyzeCooldown)).toHaveBeenCalledWith(
                'AAPL',
                '1Day'
            );

            __resetActiveStreamsForTests();
        });
    });

    /**
     * Task 10: Route ↔ client transport contract — runAnalysisStream 통합 테스트.
     *
     * route가 보내는 SSE 프레임 포맷과 `runAnalysisStream`의 파싱 로직이
     * 진정으로 맞물리는지를 vitest 안에서 검증한다.
     *
     * global.fetch를 가로채 POST(request)의 실제 Response를 반환하면,
     * `runAnalysisStream`은 production 경로 그대로 실행된다:
     * - route → heartbeatStream → `event: done\ndata: {"result":...}`
     * - runAnalysisStream → TextDecoderStream → frame 파싱 → payload.result 반환
     *
     * heartbeatStream의 SSE 포맷 또는 runAnalysisStream의 parseFrame을 변경하면
     * 이 테스트가 실패한다.
     */
    describe('Route ↔ client transport contract — runAnalysisStream (Task 10)', () => {
        it('runAnalysisStream이 route POST 응답에서 done 이벤트 result를 추출한다', async () => {
            const runAnalysisResult = {
                status: 'cached' as const,
                result: { headlineKo: 'transport contract test' },
            };
            /**
             * route는 runAnalysis 반환값에 `personalized` 플래그를 합쳐
             * heartbeatStream의 work promise를 resolve한다:
             * `{ ...runAnalysisResult, personalized: positionBucket !== undefined }`
             * 따라서 SSE done 이벤트의 payload.result에는 personalized가 포함된다.
             */
            const expectedResult = {
                ...runAnalysisResult,
                personalized: false,
            };
            vi.mocked(runAnalysis).mockResolvedValue(
                runAnalysisResult as never
            );

            /**
             * global.fetch를 가로채 `POST(request)`의 실제 Response를 반환한다.
             * runAnalysisStream은 `/api/analysis/stream`으로 fetch를 날리므로,
             * 여기서 라우트에 직접 연결하면 SSE 스택 전체가 실제로 실행된다.
             */
            const fetchSpy = vi
                .spyOn(globalThis, 'fetch')
                .mockImplementation(async (_input, init) => {
                    const body =
                        typeof init?.body === 'string' ? init.body : '';
                    return POST(
                        new Request('http://localhost/api/analysis/stream', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body,
                        })
                    );
                });

            try {
                const result = await runAnalysisStream<typeof expectedResult>({
                    type: 'technical',
                    params: {
                        symbol: 'AAPL',
                        companyName: 'Apple Inc.',
                        timeframe: '1Day',
                    },
                    messages: TEST_STREAM_MESSAGES,
                });

                // heartbeatStream이 JSON.stringify({ result: runAnalysis반환값 })으로
                // 감싸고, runAnalysisStream이 payload.result를 꺼내야 원래 값이 된다.
                // `plain`은 라우트의 `withReaderViews`가 덧붙이는 필드다(쉽게보기).
                expect(result).toEqual({
                    ...expectedResult,
                    plain: '쉽게 쓴 분석문입니다.',
                });
            } finally {
                fetchSpy.mockRestore();
            }
        });
    });

    /**
     * Task 6: non-technical 타입(overall)도 동시성 상한과 JSON 500 경로를 커버한다.
     *
     * DISPATCH 경로의 동시성 가드와 outer catch를 삭제해도 technical 타입 테스트만
     * 통과하면 녹색이 되는 구조를 방지한다.
     */
    describe('DISPATCH 경로 — 동시성 상한 + 외부 예외 JSON 500 (overall 타입)', () => {
        it('overall 타입 + cap 포화 → 503을 반환한다', async () => {
            __resetActiveStreamsForTests();
            for (let i = 0; i < MAX_CONCURRENT_ANALYSIS_STREAMS; i++) {
                incrementActiveStreams();
            }

            const response = await POST(
                makeRequest(
                    undefined,
                    JSON.stringify({
                        type: 'overall',
                        params: {
                            symbol: 'AAPL',
                            companyName: 'Apple',
                            timeframe: '1Day',
                            modelId: 'gemini-2.5-flash',
                        },
                    })
                )
            );

            expect(response.status).toBe(503);
            expect(response.headers.get('Retry-After')).toBe('30');
            expect(vi.mocked(runOverallAnalysisAction)).not.toHaveBeenCalled();

            __resetActiveStreamsForTests();
        });

        it('DISPATCH 핸들러 외부에서 동기 throw → JSON 500을 반환한다', async () => {
            // DISPATCH 핸들러 내부가 아니라 라우트 외부 try/catch가 잡는 경로.
            // overall 핸들러를 spy로 교체해 DISPATCH 이전(params 검증 등)에서
            // throw하는 상황을 재현하기 어려우므로, 현재 outer catch 경로는
            // JSON 파싱 실패(400)로 이미 검증된다. 여기서는 DISPATCH 타입에서도
            // `params`가 없으면 400이 반환됨을 추가로 검증한다.
            const response = await POST(
                makeRequest(
                    undefined,
                    JSON.stringify({ type: 'overall' }) // params 없음
                )
            );

            expect(response.status).toBe(400);
            expect(vi.mocked(runOverallAnalysisAction)).not.toHaveBeenCalled();
        });
    });

    describe('쉽게보기(plain) 배선', () => {
        /**
         * 평이화는 로케일 번역과 **병렬**로 돈다 — 입력이 한국어 원문이라 번역
         * 결과에 의존하지 않는다. 직렬로 붙이면 추가 지연이 두 마감의 합이 된다.
         */
        it('technical 결과에 plain을 동봉한다', async () => {
            vi.mocked(runAnalysis).mockResolvedValue({
                status: 'cached',
                result: { summary: 's' },
                lockedInfoDepth: [],
            } as never);

            const events = await collectSseEvents(await POST(makeRequest()));
            const done = events.find(e => e.includes('event: done'));

            expect(done).toContain('쉽게 쓴 분석문입니다');
            // 통화 코드를 함께 넘긴다 — 없으면 모델이 `421.46`처럼 단위 없는
            // 맨 숫자를 쓴다(실측). 표기로 바꾸는 것은 analysis-plain의 몫이다.
            expect(rewriteToPlainLanguage).toHaveBeenCalledWith(
                expect.objectContaining({ summary: 's' }),
                'AAPL',
                'ko',
                'USD',
                undefined
            );
        });

        /**
         * 회귀(감사 M1): 통화 해피 패스가 한 번도 실행된 적이 없었다.
         * 원화 종목이 조용히 '달러'를 받으면 화면의 모든 가격이 틀린 단위로 나간다.
         */
        it('원화 종목에는 KRW를 넘긴다', async () => {
            vi.mocked(runAnalysis).mockResolvedValue({
                status: 'cached',
                result: { summary: 's' },
                lockedInfoDepth: [],
            } as never);
            const body = JSON.stringify({
                type: 'technical',
                params: {
                    symbol: '005930.KS',
                    companyName: '삼성전자',
                    timeframe: '1Day',
                },
            });

            await collectSseEvents(await POST(makeRequest(undefined, body)));

            expect(rewriteToPlainLanguage).toHaveBeenCalledWith(
                expect.anything(),
                '005930.KS',
                'ko',
                'KRW',
                undefined
            );
        });

        /**
         * 회귀(리뷰 라운드 1): 봉투째 넘기면 `extractProse`가 모든 경로에 `result.`
         * 접두를 붙여 `dropSupersededPaths`가 조용히 no-op이 되고, 보정 전/후 매매
         * 가격 두 벌이 함께 프롬프트에 실린다. 단위 테스트는 bare 경로만 써서
         * 이 배선 결함을 못 잡았다 — 여기서 고정한다.
         */
        it('봉투가 아니라 분석 payload를 넘긴다', async () => {
            const payload = {
                summary: 's',
                actionRecommendation: { entry: 'e' },
            };
            vi.mocked(runAnalysis).mockResolvedValue({
                status: 'cached',
                result: payload,
                lockedInfoDepth: [],
            } as never);

            await collectSseEvents(await POST(makeRequest()));

            expect(rewriteToPlainLanguage).toHaveBeenCalledWith(
                payload,
                'AAPL',
                'ko',
                'USD',
                undefined
            );
            const passed = vi.mocked(rewriteToPlainLanguage).mock.calls[0][0];
            expect(passed).not.toHaveProperty('status');
            expect(passed).not.toHaveProperty('lockedInfoDepth');
        });

        /**
         * 액션은 실패를 `{ status: 'error', ... }`로 돌려주는데 그 안의 `message`가
         * 산문으로 추출된다. 그대로 두면 게이트 거부 문구를 LLM에 보내 "쉽게 쓴 에러
         * 메시지"를 만들고, 거부마다 DeepSeek 왕복이 붙는다.
         */
        it('에러 봉투에는 plain을 붙이지 않는다', async () => {
            vi.mocked(runAnalysis).mockResolvedValue({
                status: 'error',
                error: { code: 'unexpected_error', message: '오류' },
            } as never);

            await collectSseEvents(await POST(makeRequest()));

            expect(rewriteToPlainLanguage).not.toHaveBeenCalled();
        });

        /** 토글 UI가 없는 종류는 호출이 그대로 낭비다. */
        it('허용 목록 밖 타입에는 호출하지 않는다', async () => {
            const body = JSON.stringify({
                type: 'briefing',
                params: { symbol: 'AAPL' },
            });

            await collectSseEvents(await POST(makeRequest(undefined, body)));

            expect(rewriteToPlainLanguage).not.toHaveBeenCalled();
        });

        /** `facts.symbol`이 프롬프트에 들어가므로 빈 값을 넘기면 안 된다. */
        it('symbol이 없으면 호출하지 않는다', async () => {
            const body = JSON.stringify({ type: 'news', params: {} });

            await collectSseEvents(await POST(makeRequest(undefined, body)));

            expect(rewriteToPlainLanguage).not.toHaveBeenCalled();
        });

        /**
         * 회귀(감사): 봇 가드가 없어 크롤러가 매 크롤마다 DeepSeek을 태웠다.
         * 비용·동시성·SEO 세 문제가 이 한 줄에 달려 있다 — 특히 robots.txt가
         * 이 라우트를 크롤러에 열어 두었으므로, 봇이 받는 본문이 압축 산문으로
         * 바뀌면 thin 콘텐츠 리스크가 생긴다.
         */
        it('봇 요청에는 평이화를 호출하지 않는다', async () => {
            vi.mocked(isBot).mockReturnValue(true);
            vi.mocked(runAnalysis).mockResolvedValue({
                status: 'cached',
                result: { summary: 's' },
                lockedInfoDepth: [],
            } as never);

            await collectSseEvents(await POST(makeRequest()));

            expect(rewriteToPlainLanguage).not.toHaveBeenCalled();
        });

        it('DISPATCH 경로의 봇 요청에도 호출하지 않는다', async () => {
            vi.mocked(isBot).mockReturnValue(true);
            vi.mocked(runOverallAnalysisAction).mockResolvedValue({
                status: 'cached',
                result: { overallConclusionKo: 'c' },
                lockedInfoDepth: [],
            } as never);
            const body = JSON.stringify({
                type: 'overall',
                params: {
                    symbol: 'AAPL',
                    companyName: 'Apple',
                    timeframe: '1Day',
                },
            });

            await collectSseEvents(await POST(makeRequest(undefined, body)));

            expect(rewriteToPlainLanguage).not.toHaveBeenCalled();
        });

        /**
         * 회귀(감사 M7): `technical`만 양성으로 단언돼 있어, 나머지 여섯 타입 중
         * 어느 하나를 허용 목록에서 빼도 테스트가 통과했다.
         */
        it.each([
            ['overall', () => vi.mocked(runOverallAnalysisAction)],
            ['news', () => vi.mocked(submitNewsAnalysisAction)],
            ['fundamental', () => vi.mocked(runFundamentalAnalysisAction)],
            ['financials', () => vi.mocked(runFinancialsAnalysisAction)],
            ['options', () => vi.mocked(submitOptionsAnalysisAction)],
            ['congress', () => vi.mocked(runCongressTrendAction)],
        ])('%s 타입도 평이화 대상이다', async (type, getMock) => {
            getMock().mockResolvedValue({
                status: 'cached',
                result: { summary: 's' },
                lockedInfoDepth: [],
            } as never);
            const body = JSON.stringify({
                type,
                params: {
                    symbol: 'AAPL',
                    companyName: 'Apple',
                    timeframe: '1Day',
                    expirationDate: '2026-09-18',
                },
            });

            await collectSseEvents(await POST(makeRequest(undefined, body)));

            expect(rewriteToPlainLanguage).toHaveBeenCalled();
        });

        /** 재작성 실패는 분석을 막지 않는다 — plain: null로 내려가고 원본이 보인다. */
        it('평이화가 null이면 plain: null로 내려간다', async () => {
            vi.mocked(rewriteToPlainLanguage).mockResolvedValueOnce(null);
            vi.mocked(runAnalysis).mockResolvedValue({
                status: 'cached',
                result: { summary: 's' },
                lockedInfoDepth: [],
            } as never);

            const events = await collectSseEvents(await POST(makeRequest()));
            const done = events.find(e => e.includes('event: done'));

            expect(done).toContain('"plain":null');
        });
    });
});
