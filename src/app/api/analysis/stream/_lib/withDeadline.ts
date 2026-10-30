import { LocalizedStreamError } from '@/shared/lib/sse/LocalizedStreamError';

/**
 * 스트림 길이 상한: LLM 왕복이 이걸 넘으면 서버가 error 이벤트를 내보내고 연결을 닫는다.
 * 폭주한 LLM 호출이 SSE 연결과 Node 워커 슬롯을 무한정 붙들지 못하게 한다.
 *
 * **왜 10분인가.** 5분은 프리미엄 모델에 측정상 빠듯했다. 2026-08-09에 PLTR(promptTokens 29k)
 * `deepseek-v4.1-pro` 호출이 248.5초에 돌아와 여유가 52초뿐이었고, 같은 키의 다음 요청은 300초에서
 * 끊겼다. 상한은 가장 느린 정상 호출 *옆*이 아니라 *위*에 있어야 한다.
 *
 * 10분은 가정이 아니라 실측이다. `/api/sse-probe`의 `duration=600&interval=25`가 프로덕션을 통해 두 번
 * 완주했다(601.4초/601.2초, CF PoP LAX·SJC). 드리프트는 1초 미만, 도착 간격은 24.9~25.3초라 엣지
 * 버퍼링이 없다. 90초 침묵 대조군은 정확히 61.0초에 끊겼는데 ALB idle timeout이다. cloudflared 이전 뒤
 * 같은 대조군은 **125.9초**(Cloudflare Proxy Read Timeout)에 끊기고 600초 heartbeat 런은 정확히
 * 25.0초 간격으로 완주했다. 벽이 두 배가 됐어도 `HEARTBEAT_INTERVAL_MS`(25초)가 여전히 그 벽을 넘긴다.
 * 이 값을 10분 위로 올리려면 새로 측정해야 한다.
 *
 * **셧다운 드레인(`SHUTDOWN_DRAIN_DEADLINE_MS`, 180초)과 일부러 맞추지 않는다.** 맞추려면 드레인을
 * 약 180초에서 605초로 늘려야 하는데 cloudflared가 `TUNNEL_GRACE_PERIOD`를 180초로 제한해 표현조차
 * 못 한다. 인스턴스 교체당 약 7분이 늘고 두 인스턴스 롤링이 약 18분에서 약 30분이 된다. 얻는 것은
 * "배포 중에도 진행 중 분석이 산다"인데, 배포는 주 몇 회, LLM 호출은 하루 약 19회다. 180초 < 마감의
 * 간극은 5분일 때도 있었고 관측된 실패가 없다. 넓혀도 새 실패 모드는 없고 기존 노출만 조금 늘 뿐이다.
 *
 * 요청별이 아니라 단일 공유 값이다. 모든 분석 호출이 같은 모델 등급 상한을 쓰므로 괜찮다.
 */
export const STREAM_DEADLINE_MS = 10 * 60 * 1_000;

/**
 * `run(signal)`을 고정 마감과 경주시킨다. 마감을 넘기면 localized 메시지로 reject해
 * `heartbeatStream`이 SSE `error` 이벤트를 내보내고 연결을 닫는다.
 *
 * ⚠️ `request.signal`을 core `run*`에 **의도적으로 전달하지 않는다.** core의 분석 실행은
 * `dedupeInFlight(cacheKey, …)`로 공유돼 같은 캐시 키의 모든 호출자가 **하나의 promise**를 기다린다.
 * 특정 클라이언트의 signal을 꽂으면 그 한 명이 탭을 닫는 순간 공유 promise가 reject되고, 같은 심볼을
 * 기다리던 SEO prewarm 크론까지 실패한다(그 유닛은 6시간 backoff로 밀린다). 게다가 캐시 write는
 * `await callAnalysisAi` **뒤에** 있어 abort하면 캐시가 비고, 방문자가 이탈할 때마다 캐시 워밍이
 * 사라진다. 이탈한 방문자의 LLM 호출은 낭비가 아니라 다음 방문자와 크롤러를 위한 선투자다. 취소가
 * 필요하면 먼저 core의 `dedupeInFlight`에 참조 카운팅을 넣어 마지막 대기자가 떠날 때만 abort되게 해야
 * 한다. 폭주 방지는 클라이언트 유무와 무관한 이 마감이 맡는다.
 *
 * 마감이 **자체 `AbortController`로 작업을 실제 취소**하는 게 핵심이다. 취소하지 않으면 스트림만 닫히고
 * core 호출은 provider 타임아웃(어댑터 기본 1시간)까지 살아 있다. 그 promise는 `dedupeInFlight` Map에
 * 남으므로 같은 캐시 키의 이후 요청이 죽은 promise에 합류해 `STREAM_DEADLINE_MS`씩 기다렸다 실패한다.
 * 이 signal은 클라이언트별이 아니라 **작업별**이라 위의 공유 abort 문제가 없다.
 */
export function withDeadline<T>(
    run: (signal: AbortSignal) => Promise<T>,
    timeoutMessage: string
): Promise<T> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
            controller.abort();
            reject(new LocalizedStreamError(timeoutMessage));
        }, STREAM_DEADLINE_MS);
    });
    // run()이 **동기적으로** throw할 수 있다(핸들러가 params를 즉시 구조분해하는 경우). async 래퍼로
    // 감싸 rejection으로 바꿔야 아래 race가 구성되고 finally가 붙는다 — 아니면 타이머가 살아남아
    // 마감 뒤 아무도 듣지 않는 deadline이 reject된다(unhandled rejection).
    const started = (async () => run(controller.signal))();
    // 작업이 먼저 끝나면 타이머를 즉시 회수한다 — 없으면 매 요청이 마감짜리 타이머와 reject 클로저를
    // 붙들어, LLM 작업까지 떠안은 인스턴스에서 그대로 누적된다.
    return Promise.race([started, deadline]).finally(() => {
        if (timer !== undefined) clearTimeout(timer);
    });
}
