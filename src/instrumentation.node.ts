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
 * 분석 SSE 스트림의 최대 지속 시간(`STREAM_DEADLINE_MS` = 10분)보다 **의도적으로 짧다.**
 * 통상 분석(30~90s)은 완주하고, 180s를 넘는 분석은 SIGKILL로 잘린다.
 *
 * 왜 마감에 맞추지 않는가 — 맞추려면 아래 인프라 3값을 605/605/610으로 같이 올려야 하는데,
 * `deregistration_delay`가 185→605가 되면 인스턴스 교체마다 약 7분이 붙어 2대 롤이
 * 18분에서 30분대로 늘어난다. 그 대가로 얻는 것은 "배포 중이던 분석이 살아남는다" 하나이고,
 * 배포는 주 몇 회, LLM 호출은 하루 20건 수준이다. 이 불일치는 마감이 5분이던 시절에도
 * 있었고(180 < 300) 실패로 관측된 적이 없다 — 10분으로 넓혀도 새 실패 모드가 아니라
 * 기존 모드의 노출이 조금 늘 뿐이다. 배포 중 장기 분석 보존이 필요해지면 그때 위 비용을
 * 감수하고 세 값을 함께 올린다.
 *
 * 인프라 타이밍과의 정합(06-alb-asg.sh, user-data.sh):
 *   - deregistration_delay 185s  ≥  이 값(SIGTERM은 deregistration 완료 후 오므로
 *                                      draining 중 새 연결이 들어오지 않는다)
 *   - docker stop -t 185s        >  이 값(drain이 끝나고 process.exit(0) 후 docker가 멈춤)
 *   - TimeoutStopSec 190s        ≥  docker stop -t(systemd 안전망)
 */
const SHUTDOWN_DRAIN_DEADLINE_MS = 180_000;

/**
 * drain이 끝난 뒤 exit까지의 유예. core의 fire-and-forget 캐시 write가 빠져나갈
 * 시간을 준다 — 자세한 근거는 아래 `.finally` 주석 참고.
 */
const POST_DRAIN_GRACE_MS = 1_000;

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
                /**
                 * 스트림이 0이 된 직후 바로 exit하면 **캐시 write가 유실된다.**
                 * core의 분석 캐시 저장은 의도적으로 fire-and-forget이고
                 * (`cache.set(...).catch(...)`, await하지 않음) siglens의
                 * `pendingTasks` 레지스트리에도 등록되지 않는다. 즉 `run*`는 Upstash
                 * HTTP 요청이 아직 날아가는 중에 반환하고, 그 직후 done 프레임이 나가고
                 * 카운터가 0이 된다. 여기서 즉시 exit하면 방금 태운 LLM 결과가 캐시에
                 * 안 남아, 180초 drain으로 지켜낸 그 분석이 다음 방문자에겐 없는 셈이 된다.
                 *
                 * 짧은 유예로 그 in-flight write를 흘려보낸다. drain 예산(180s) 대비
                 * 무시할 수 있는 비용이고, docker stop -t 185s 안에 충분히 들어간다.
                 */
                setTimeout(() => {
                    console.log('[instrumentation] drain complete — exiting');
                    process.exit(0);
                }, POST_DRAIN_GRACE_MS);
            });
    };

    // additive 등록 — Next 자체 종료 로직을 대체하지 않는다.
    process.on('SIGTERM', handleShutdown);
    process.on('SIGINT', handleShutdown);
}
