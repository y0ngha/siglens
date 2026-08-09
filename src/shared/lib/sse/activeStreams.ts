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

/** in-flight SSE 스트림이 시작될 때 호출. `heartbeatStream` 전용 — 직접 호출 금지. */
export function incrementActiveStreams(): void {
    count++;
}

/**
 * in-flight SSE 스트림이 종료될 때 호출(done/error/cancel 모든 경로).
 *
 * count가 0에 도달하면 등록된 리스너를 모두 즉시 호출하고 집합을 비운다.
 * count가 이미 0인 경우(이중 decrement 방어)에는 0 미만으로 떨어지지 않도록 보호한다.
 * `heartbeatStream` 전용 — 직접 호출 금지.
 */
export function decrementActiveStreams(): void {
    if (count > 0) count--;
    if (count === 0) {
        for (const fn of zeroListeners) fn();
        zeroListeners.clear();
    }
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
 * 봇의 상한 배수.
 *
 * 봇은 상한에서 아예 빼지 않고 더 높은 천장을 준다. 빼면 `isBot`이 순수 User-Agent
 * 매칭이라(`shared/api/isBot.ts`) UA에 'bot'만 넣으면 무제한이 된다. LLM·FMP 비용은
 * `skipEnqueueIfMiss`가 막지만(봇의 캐시 미스는 provider 호출 전에 끝난다) 게이팅
 * 단계의 DB·Redis 조회는 그대로 돌아, 위조 봇 부하가 진짜 Googlebot의 응답을 느리게
 * 만들 수 있다.
 *
 * 배수를 두는 이유는 반대 방향의 사고를 막기 위해서다: 사람 트래픽이 상한을 채운
 * 동안 Googlebot이 503을 받으면 렌더된 DOM에 실패 배너만 남고, robots.txt에 이
 * 경로를 연 의미가 사라진다.
 */
const BOT_STREAM_LIMIT_MULTIPLIER = 2;

/**
 * 새 분석 스트림을 받아도 되는지. false면 호출부는 503으로 거절해야 한다.
 *
 * @param isBot 봇 요청이면 더 높은 천장을 적용한다(위 주석 참고).
 */
export function canAcceptAnalysisStream(isBot = false): boolean {
    const limit = isBot
        ? MAX_CONCURRENT_ANALYSIS_STREAMS * BOT_STREAM_LIMIT_MULTIPLIER
        : MAX_CONCURRENT_ANALYSIS_STREAMS;
    return count < limit;
}
