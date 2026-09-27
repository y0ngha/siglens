/**
 * In-flight SSE 스트림 graceful-shutdown drain 카운터.
 *
 * `heartbeatStream`이 스트림을 시작할 때 {@link incrementActiveStreams}를 호출해 카운터를
 * 증가시키고, 모든 종료 경로(done/error/cancel)에서 정확히 한 번 {@link decrementActiveStreams}를
 * 호출해 감소시킨다.
 *
 * SIGTERM 핸들러(`instrumentation.node.ts`)가 {@link waitForActiveStreams}를 통해 카운터가
 * 0에 도달할 때까지 대기해, 배포 롤링 중 진행 중인 LLM 분석이 완주하거나
 * `SHUTDOWN_DRAIN_DEADLINE_MS`(180s)가 지날 때까지 프로세스가 살아있도록 한다.
 *
 * 모듈 레벨 싱글톤 — Next 서버 프로세스 수명 동안 공유된다. JavaScript 단일 스레드이므로
 * 뮤텍스 없이 안전하다.
 */

let count = 0;

/**
 * count가 0에 도달했을 때 깨울 리스너 집합.
 *
 * `waitForActiveStreams`가 등록하고, `decrementActiveStreams`가 0 도달 시 전부 호출·비운다.
 * 정상 운용에서는 shutdown 시 최대 1개의 waiter만 등록되므로 Set 오버헤드는 무시 가능.
 */
const zeroListeners = new Set<() => void>();

/**
 * in-flight SSE 스트림이 시작될 때 호출. `registerActiveStream` 전용 — 직접 호출 금지.
 */
export function incrementActiveStreams(): void {
    count++;
}

/**
 * in-flight SSE 스트림이 종료될 때 호출(done/error/cancel 모든 경로).
 *
 * count가 0에 도달하면 등록된 리스너를 모두 즉시 호출하고 집합을 비운다.
 * count가 이미 0인 경우(이중 decrement 방어)에는 0 미만으로 떨어지지 않도록 보호한다.
 * `registerActiveStream` 전용 — 직접 호출 금지.
 */
export function decrementActiveStreams(): void {
    if (count > 0) count--;
    if (count === 0) {
        for (const fn of zeroListeners) fn();
        zeroListeners.clear();
    }
}

/**
 * Register one unit of in-flight server work (analysis stream or agent turn)
 * and get an idempotent release. Use this instead of the raw pair.
 */
export function registerActiveStream(): () => void {
    incrementActiveStreams();
    let released = false;
    return () => {
        if (released) return;
        released = true;
        decrementActiveStreams();
    };
}

/**
 * in-flight 스트림이 0에 도달하거나 `deadlineMs`가 지날 때까지 대기한다.
 *
 * SIGTERM 핸들러가 `drainBackgroundTasks`와 병렬로 호출한다(같은 deadline 공유).
 * count가 이미 0이면 즉시 resolve한다.
 *
 * @param deadlineMs 최대 대기 시간(ms). `SHUTDOWN_DRAIN_DEADLINE_MS`와 동일 값.
 */
export function waitForActiveStreams(deadlineMs: number): Promise<void> {
    if (count === 0) return Promise.resolve();
    return new Promise<void>(resolve => {
        const done = (): void => {
            clearTimeout(timer);
            resolve();
        };
        zeroListeners.add(done);
        const timer = setTimeout(() => {
            zeroListeners.delete(done);
            resolve();
        }, deadlineMs);
    });
}

/** 테스트 간 모듈 상태를 초기화한다. */
export function __resetActiveStreamsForTests(): void {
    count = 0;
    zeroListeners.clear();
}

/** 현재 in-flight 스트림 수(테스트/진단용). */
export function __activeStreamCount(): number {
    return count;
}

/**
 * 인스턴스당 동시 분석 상한.
 *
 * `/api/analysis/stream`은 인증 없는 공개 POST고, 요청 하나가 LLM 왕복 내내(최대 5분)
 * Node 요청 슬롯을 붙든다. 심볼만 바꾸면 캐시도 `dedupeInFlight`도 비켜 가므로,
 * 루프 하나가 t4g.medium의 메모리·소켓을 고갈시킬 수 있다. ASG의 요청 수 기반 스케일링은
 * 이 부하를 거의 감지하지 못하고(90초 분석 200개 = 분당 ~133요청), CPU 정책도
 * warmup까지 수 분이 걸린다.
 *
 * 그래서 인스턴스 레벨에서 먼저 막는다. 정상 트래픽은 이 근처에 오지 않는다 —
 * 넘으면 과부하이거나 남용이다.
 *
 * ponytail: 프로세스 로컬 카운터다. 인스턴스가 늘면 상한도 같이 늘어난다(의도).
 * 사용자·IP 단위 제한이 필요하면 Cloudflare rate limiting이나 Upstash 토큰 버킷으로
 * 별도로 올려야 한다.
 */
export const MAX_CONCURRENT_ANALYSIS_STREAMS = 24;

/**
 * 새 분석 스트림을 받아도 되는지. false면 호출부는 503으로 거절해야 한다.
 *
 * **모든 호출자에 같은 상한(2026-09-27).** 예전엔 봇 요청에 2배 천장을 줬다 —
 * `isBot`이 순수 User-Agent 문자열 매칭이라(`shared/api/isBot.ts`) curl/,
 * python-requests, axios/, node-fetch 같은 일반 스크립트 클라이언트까지
 * "봇"으로 잡히는데, 그 판정에 더 높은 동시성 천장을 얹는 건 그대로 남용
 * 경로였다 — 위조도, 판별 불가도 필요 없이 스크립트가 기본으로 그 UA를 쓴다.
 * 생성이 UA에 의존하지 않는 지금(`api/analysis/stream/route.ts` 상단 불변식)
 * 천장만 따로 UA로 가를 이유가 없다.
 *
 * **감수하는 트레이드오프**: 사람 트래픽이 상한을 다 채운 순간과 겹치면
 * 크롤러가 503을 받을 수 있다. 정상 동시 접속은 이 근처에도 오지 않으므로
 * (위 `MAX_CONCURRENT_ANALYSIS_STREAMS` 주석 참고) 드물 것으로 판단한다.
 * IP/세션 단위 rate limiting은 별도 후속 과제.
 */
export function canAcceptAnalysisStream(): boolean {
    return count < MAX_CONCURRENT_ANALYSIS_STREAMS;
}
