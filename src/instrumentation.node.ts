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

/**
 * Drain deadline(ms). `docker stop -t 30`의 30초 stop-timeout보다 짧게 잡아
 * SIGKILL 전에 정상 종료를 마칠 여유를 둔다. 06-alb-asg.sh의
 * deregistration_delay.timeout_seconds=30과도 정합한다.
 */
const SHUTDOWN_DRAIN_DEADLINE_MS = 25_000;

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
            `[instrumentation] ${signal} received — draining background tasks (deadline ${SHUTDOWN_DRAIN_DEADLINE_MS}ms)`
        );
        stopAcceptingBackgroundTasks();

        void drainBackgroundTasks(SHUTDOWN_DRAIN_DEADLINE_MS)
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
