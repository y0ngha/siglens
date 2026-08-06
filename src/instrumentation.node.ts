/**
 * Node 런타임 전용 graceful-shutdown 등록 로직.
 *
 * `process.on` / `process.exit`는 Edge 런타임에서 미지원이라 Turbopack이 정적
 * 분석 시 경고를 낸다. instrumentation.ts에서 직접 호출하면 (Node 가드로 런타임에는
 * 실행되지 않아도) edge 컴파일 대상에 포함돼 빌드 경고가 발생한다. 이 모듈을 Node
 * 분기에서만 `await import`해 edge 번들에서 완전히 배제한다.
 */
import {
    drainBackgroundTasks,
    stopAcceptingBackgroundTasks,
} from '@/entities/ticker/lib/backgroundTask';
import { waitForActiveStreams } from '@/shared/lib/sse/activeStreams';

/**
 * Drain deadline(ms).
 *
 * 분석 SSE 스트림의 최대 지속 시간(STREAM_DEADLINE_MS = 5분)을 고려해 180s로 설정한다.
 * 5분보다 짧으므로 deadline 내 완주를 보장하지는 않지만, 통상 분석(30~90s)은 완주한다.
 * 180s를 넘는 분석은 SIGKILL로 잘린다 — 허용된 트레이드오프.
 *
 * 인프라 타이밍과의 정합(06-alb-asg.sh, user-data.sh):
 *   - deregistration_delay 185s  ≥  이 값(SIGTERM은 deregistration 완료 후 오므로
 *                                      draining 중 새 연결이 들어오지 않는다)
 *   - docker stop -t 185s        >  이 값(drain이 끝나고 process.exit(0) 후 docker가 멈춤)
 *   - TimeoutStopSec 190s        ≥  docker stop -t(systemd 안전망)
 */
const SHUTDOWN_DRAIN_DEADLINE_MS = 180_000;

/** 시그널당 핸들러 중복 등록 방지 가드(같은 프로세스에서 register 재호출 대비). */
let shutdownHandlersRegistered = false;

/** SIGTERM/SIGINT에 백그라운드 작업 drain 핸들러를 additive하게 등록한다. */
export function registerShutdownHandlers(): void {
    if (shutdownHandlersRegistered) return;
    shutdownHandlersRegistered = true;

    let shuttingDown = false;
    const handleShutdown = (signal: NodeJS.Signals): void => {
        // 두 시그널이 연달아 와도 drain을 한 번만 수행한다.
        if (shuttingDown) return;
        shuttingDown = true;

        console.log(
            `[instrumentation] ${signal} received — draining background tasks and SSE streams (deadline ${SHUTDOWN_DRAIN_DEADLINE_MS}ms)`
        );
        stopAcceptingBackgroundTasks();

        // 백그라운드 작업(캐시 쓰기, 번역 잡)과 in-flight SSE 스트림(LLM 분석)을
        // 병렬로 drain한다 — 양쪽 모두 같은 deadline 안에서 완료를 기다린다.
        void Promise.all([
            drainBackgroundTasks(SHUTDOWN_DRAIN_DEADLINE_MS),
            waitForActiveStreams(SHUTDOWN_DRAIN_DEADLINE_MS),
        ])
            .catch(err => {
                console.error('[instrumentation] drain error:', err);
            })
            .finally(() => {
                console.log('[instrumentation] drain complete — exiting');
                process.exit(0);
            });
    };

    // additive 등록 — Next 자체 종료 로직을 대체하지 않는다.
    process.on('SIGTERM', handleShutdown);
    process.on('SIGINT', handleShutdown);
}
