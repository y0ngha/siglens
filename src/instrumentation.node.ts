/**
 * Node 런타임 전용 graceful-shutdown 등록 로직.
 *
 * `process.on` / `process.exit`는 Edge 런타임에서 미지원이라 Turbopack이 정적
 * 분석 시 경고를 낸다. instrumentation.ts에서 직접 호출하면 (Node 가드로 런타임에는
 * 실행되지 않아도) edge 컴파일 대상에 포함돼 빌드 경고가 발생한다. 이 모듈을 Node
 * 분기에서만 `await import`해 edge 번들에서 완전히 배제한다.
 */
import { endDatabaseClient } from '@/shared/db/client';
import {
    drainBackgroundTasks,
    stopAcceptingBackgroundTasks,
} from '@/shared/lib/backgroundTask';
import { waitForActiveStreams } from '@/shared/lib/sse/activeStreams';

/**
 * ISR 캐시 핸들러(`cache-handler/uploadQueue.mjs`)가 업로드 drain 함수를 등록하는 전역 키.
 * 값은 drain 함수들의 `Set`이다(핸들러 모듈 사본이 여럿이어도 서로 덮어쓰지 않게).
 *
 * 핸들러는 Next가 `next.config.ts`의 절대 경로로 동적 import하는 번들 밖 모듈이라 여기서
 * import하면 **다른 모듈 인스턴스**(빈 큐)를 받는다. 그래서 핸들러가 `Symbol.for`로 걸어 둔
 * 레지스트리를 꺼내 쓴다. 핸들러가 등록되지 않은 환경(dev/E2E, offline build)에서는 없다.
 * 문자열은 `DRAIN_UPLOADS_SYMBOL`과 반드시 같아야 한다.
 */
const ISR_DRAIN_UPLOADS_SYMBOL = Symbol.for('siglens.isrCache.drainUploads');

type DrainUploads = (deadlineMs: number) => Promise<number>;

/** 백그라운드 S3 업로드(캐시 miss 응답에서 떼어낸 PUT)를 마감 안에서 전부 기다린다. */
async function drainIsrCacheUploads(deadlineMs: number): Promise<void> {
    const registry = (globalThis as Record<symbol, unknown>)[
        ISR_DRAIN_UPLOADS_SYMBOL
    ];
    if (!(registry instanceof Set) || registry.size === 0) return;
    const drains = [...registry].filter(
        (drain): drain is DrainUploads => typeof drain === 'function'
    );
    const remaining = (
        await Promise.all(drains.map(drain => drain(deadlineMs)))
    ).reduce((sum, count) => sum + count, 0);
    if (remaining > 0) {
        console.warn(
            `[instrumentation] ${remaining} ISR cache upload(s) still in flight at deadline`
        );
    }
}

/**
 * Drain deadline(ms).
 *
 * 분석 SSE 스트림의 최대 지속 시간(`STREAM_DEADLINE_MS` = 10분)보다 **의도적으로 짧다.**
 * 통상 분석(30~90s)은 완주하고, 180s를 넘는 분석은 SIGKILL로 잘린다.
 *
 * 왜 마감에 맞추지 않는가 — 맞추려면 인프라 값들을 605대로 같이 올려야 하는데,
 * 인스턴스 교체마다 약 7분이 붙어 2대 롤이 18분에서 30분대로 늘어난다. 그 대가로 얻는
 * 것은 "배포 중이던 분석이 살아남는다" 하나이고, 배포는 주 몇 회, LLM 호출은 하루 20건
 * 수준이다. 이 불일치는 마감이 5분이던 시절에도 있었고(180 < 300) 실패로 관측된 적이
 * 없다 — 10분으로 넓혀도 새 실패 모드가 아니라 기존 모드의 노출이 조금 늘 뿐이다.
 *
 * 2026-08 cloudflared 전환 이후에는 애초에 **표현 불가능**하기도 하다:
 * `TUNNEL_GRACE_PERIOD`의 하드 상한이 180초다(185s를 주면 cloudflared가 기동을 거부).
 *
 * 인프라 타이밍과의 정합(06-asg.sh, user-data.sh):
 *   - cloudflared TUNNEL_GRACE_PERIOD 180s  ≥ 이 값. systemd가 앱보다 **먼저** 터널을
 *                                             내리므로, 이 드레인이 시작될 때는 이미
 *                                             새 요청이 들어오지 않는다(ALB
 *                                             deregistration_delay가 하던 역할).
 *   - docker stop -t 185s                   > 이 값(drain이 끝나고 process.exit(0) 후 멈춤)
 *   - TimeoutStopSec 190s                   ≥ docker stop -t(systemd 안전망)
 *   - ASG 라이프사이클 훅 heartbeat 420s      ≥ 180 + 190 + 여유
 */
const SHUTDOWN_DRAIN_DEADLINE_MS = 180_000;

/**
 * drain이 끝난 뒤 exit까지의 유예. core의 fire-and-forget 캐시 write가 빠져나갈
 * 시간을 준다 — 자세한 근거는 아래 `.finally` 주석 참고.
 */
const POST_DRAIN_GRACE_MS = 1_000;

/**
 * drain 뒤 DB 풀을 닫을 때 진행 중 쿼리를 기다리는 최대 시간(초).
 *
 * drain이 모든 요청·백그라운드 작업을 이미 기다렸으므로 통상 남은 쿼리가 없어 즉시 끝난다.
 * 풀 종료는 아래 유예(`POST_DRAIN_GRACE_MS`)와 **병행**으로 돌려 둘 중 긴 쪽만큼만 더한다 —
 * 최악도 180 + 5 = 185s로 `docker stop -t 185s`에 맞물리고, 넘어가면 SIGKILL이 같은 결과
 * (소켓 정리)를 낸다. 즉 best-effort다.
 */
const DB_POOL_END_TIMEOUT_SECONDS = 5;

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

        // 백그라운드 작업(캐시 쓰기, 번역 잡), in-flight SSE 스트림(LLM 분석), ISR 캐시의
        // 백그라운드 S3 업로드를 병렬로 drain한다 — 모두 같은 deadline 안에서 완료를 기다린다.
        void Promise.all([
            drainBackgroundTasks(SHUTDOWN_DRAIN_DEADLINE_MS),
            waitForActiveStreams(SHUTDOWN_DRAIN_DEADLINE_MS),
            drainIsrCacheUploads(SHUTDOWN_DRAIN_DEADLINE_MS),
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
                const dbPoolClosed = endDatabaseClient(
                    DB_POOL_END_TIMEOUT_SECONDS
                ).catch(err => {
                    console.warn('[instrumentation] db pool end error:', err);
                });
                setTimeout(() => {
                    void dbPoolClosed.finally(() => {
                        console.log(
                            '[instrumentation] drain complete — exiting'
                        );
                        process.exit(0);
                    });
                }, POST_DRAIN_GRACE_MS);
            });
    };

    // additive 등록 — Next 자체 종료 로직을 대체하지 않는다.
    process.on('SIGTERM', handleShutdown);
    process.on('SIGINT', handleShutdown);
}
