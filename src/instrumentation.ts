/**
 * Next.js instrumentation hook — Node 서버 프로세스에서 부팅 시 1회 실행된다.
 * (Next.js 16은 `instrumentation.ts`를 별도 config 플래그 없이 기본 인식한다.)
 *
 * 여기서 SIGTERM/SIGINT graceful-shutdown 핸들러를 등록한다. AWS 배포 롤 시
 * systemd `ExecStop=docker stop -t 30`이 컨테이너에 SIGTERM을 보내고 30초 후
 * SIGKILL한다. 핸들러가 없으면 in-flight `fireAndForget` 백그라운드 작업(캐시
 * 쓰기, 번역 잡)이 그대로 유실된다.
 *
 * 실제 핸들러 등록은 `instrumentation.node.ts`(Node 전용)에 위임하고 Node
 * 런타임에서만 `await import`한다. `process.on`/`process.exit`는 Edge 런타임에서
 * 미지원이라, 이 분리로 edge 컴파일 번들에서 해당 API를 완전히 배제해 빌드
 * 경고를 막는다.
 */
export async function register(): Promise<void> {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return;
    const { registerShutdownHandlers } = await import('./instrumentation.node');
    registerShutdownHandlers();
}
