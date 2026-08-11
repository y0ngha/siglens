/**
 * AI 응답 지연·연결 오류 최악 시나리오.
 *
 * SSE 라우트 POST 핸들러를 통해 end-to-end로 검증한다. 분석 실행
 * 레이어(runAnalysisBridge)만 목킹하고 나머지는 happy-path 기본값을 쓴다.
 *
 * `withDeadline`은 10분(STREAM_DEADLINE_MS) 후 자체 AbortController를 abort하고
 * deadline promise를 reject한다. heartbeatStream이 그 rejection을 받아
 * `event: error`로 변환한다. fake timer로 10분을 앞당겨 이 경로를 검증한다.
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
    DrizzlePortfolioRepository: vi.fn().mockImplementation(function () {
        return { findByUserAndSymbol: vi.fn().mockResolvedValue(null) };
    }),
}));

// runAnalysis는 브릿지 모듈로 분리돼 있다 — DISPATCH 경로와 달리 직접 목킹한다.
vi.mock('@/app/api/analysis/stream/runAnalysisBridge', () => ({
    runAnalysis: vi.fn(),
}));

// DISPATCH 테이블에 등록된 액션들 — 이 파일의 테스트는 technical 타입만 사용하므로
// 나머지 액션은 기본 vi.fn()으로 충분하다.
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

// --- Imports ---

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '@/app/api/analysis/stream/route';
import { runAnalysis } from '@/app/api/analysis/stream/runAnalysisBridge';
import { HEARTBEAT_INTERVAL_MS } from '@/shared/lib/sse/heartbeatStream';

// 10분 — route.ts의 STREAM_DEADLINE_MS와 동기화한다.
// 미export 상수이므로 값을 직접 선언한다. 값이 바뀌면 이 테스트도 실패해 불일치를 잡아준다.
const STREAM_DEADLINE_MS = 10 * 60 * 1_000;

const decoder = new TextDecoder();

function makeRequest(body?: string): Request {
    return new Request('http://localhost/api/analysis/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:
            body ??
            JSON.stringify({
                type: 'technical',
                params: {
                    symbol: 'AAPL',
                    companyName: 'Apple Inc.',
                    timeframe: '1Day',
                },
            }),
    });
}

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

describe('AI 응답 지연·연결 오류 최악 시나리오', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('10분 마감 초과 → event:error 방출 + withDeadline 내부 signal이 abort된다', async () => {
        /**
         * runAnalysis는 절대 resolve하지 않는 promise를 반환한다 — LLM 응답이
         * 끝없이 지연되는 상황을 시뮬레이션한다. withDeadline이 5분 뒤 자체
         * AbortController를 abort하고 deadline promise를 reject한다.
         *
         * capturedSignal은 route가 runAnalysis에 전달한 signal이다.
         * withDeadline이 abort하면 이 signal도 aborted 상태가 되어야 한다.
         *
         * 주의: vi.advanceTimersByTime(600_000)은 heartbeat interval(25s)도 24번
         * 발화시켜 heartbeat 청크들이 error 청크보다 앞에 큐에 쌓인다. await로
         * 마이크로태스크를 소비하며 error 이벤트를 찾을 때까지 드레인한다.
         */
        let capturedSignal: AbortSignal | undefined;
        vi.mocked(runAnalysis).mockImplementation(
            (_symbol, _name, _tf, _force, _fmp, options) => {
                capturedSignal = options?.signal;
                return new Promise<never>(() => {}); // 절대 resolve하지 않는다.
            }
        );

        const response = await POST(makeRequest());
        const reader = response.body!.getReader();

        await reader.read(); // event: open 소비

        // 10분 마감을 발화시킨다 — withDeadline의 setTimeout + heartbeat interval 24회.
        vi.advanceTimersByTime(STREAM_DEADLINE_MS);

        // heartbeat 청크들을 건너뛰고 error 청크를 찾는다.
        // 각 await reader.read()는 마이크로태스크를 소비해 promise chain이 정착할 기회를 준다.
        //
        // 드레인 상한은 상수에서 유도한다 — 마감을 늘리면 heartbeat 개수도 함께 늘어나므로,
        // 고정 숫자로 두면 마감 변경 때마다 이 루프가 조용히 모자라 error 청크에 닿지 못한다
        // (실제로 5분→10분 변경에서 20회 상한이 24개 heartbeat에 막혔다).
        const maxChunks =
            Math.ceil(STREAM_DEADLINE_MS / HEARTBEAT_INTERVAL_MS) + 5;
        let errorText: string | undefined;
        for (let i = 0; i < maxChunks; i++) {
            const { value, done } = await reader.read();
            if (done) break;
            const text = decoder.decode(value);
            if (text.includes('event: error')) {
                errorText = text;
                break;
            }
        }

        expect(errorText).toBeDefined();
        // 한국어 타임아웃 메시지 — route.ts의 withDeadline에서 정의한 문자열.
        expect(errorText).toContain('시간이 초과');

        // withDeadline은 자체 AbortController를 abort했으므로 그 signal도 abort 상태다.
        expect(capturedSignal).toBeInstanceOf(AbortSignal);
        expect(capturedSignal!.aborted).toBe(true);
    });

    it('LLM 연결 오류 → event:error를 방출하고 스트림을 정상 종료한다', async () => {
        /**
         * runAnalysis가 즉시 reject하는 케이스 — 네트워크 오류나 LLM 제공자 500 응답.
         * heartbeatStream이 reject를 받아 event:error를 방출하고 스트림을 닫는다.
         */
        vi.mocked(runAnalysis).mockRejectedValue(
            new Error('ECONNREFUSED: LLM provider unreachable')
        );

        const events = await collectSseEvents(await POST(makeRequest()));

        const errorEvent = events.find(e => e.includes('event: error'));
        expect(errorEvent).toBeDefined();
        // 내부 영문 오류는 브라우저로 새지 않는다 — heartbeatStream이 제네릭 한국어
        // 메시지로 바꾼다(원문은 `[analysis-stream] failed:` 로그에만 남는다).
        expect(errorEvent).not.toContain('ECONNREFUSED');
        expect(errorEvent).toContain('분석 중 오류가 발생했습니다');

        // collectSseEvents가 반환했다 = 스트림이 정상 종료됐다
        // (done=true에 도달하지 않으면 무한 루프로 타임아웃).
    });

    it('마감 전 응답 도착 → event:done을 방출하고 마감 타이머를 회수한다', async () => {
        /**
         * 응답이 마감(5분) 전에 도착하면 withDeadline의 finally가 clearTimeout을 호출하고
         * 에러 없이 done 이벤트가 방출된다. clearTimeout spy로 타이머 회수를 검증한다.
         */
        const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

        vi.mocked(runAnalysis).mockResolvedValue({
            status: 'done' as const,
            result: {},
        } as never);

        const events = await collectSseEvents(await POST(makeRequest()));

        const doneEvent = events.find(e => e.includes('event: done'));
        expect(doneEvent).toBeDefined();

        // 응답이 도착했으므로 마감 타이머가 회수됐어야 한다.
        expect(clearTimeoutSpy).toHaveBeenCalled();
    });
});
