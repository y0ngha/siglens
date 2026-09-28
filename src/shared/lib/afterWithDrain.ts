import { after } from 'next/server';
import { fireAndForget } from './backgroundTask';

/**
 * 응답을 먼저 돌려준 뒤 `task`를 `after()`로 실행하되, SIGTERM drain이 그 완료를
 * 기다리게 한다.
 *
 * `after()`만 쓰면 배포 중 인스턴스 교체(SIGTERM → `process.exit`)가 콜백을 고아로
 * 만든다 — cron 배치가 조용히 사라지거나, 배치가 쥔 Redis 락이 TTL까지 풀리지
 * 않는다. 그래서 `task`가 끝날 때 settle되는 promise를 `fireAndForget` 레지스트리에
 * 먼저 등록해 `drainBackgroundTasks`가 기다릴 대상을 만든다.
 *
 * `task`는 자기 실패를 스스로 처리(로깅)해야 한다. 여기서는 예외와 무관하게
 * drain 대기만 풀어 준다.
 */
export function afterWithDrain(task: () => Promise<void>): void {
    let markDone!: () => void;
    fireAndForget(
        new Promise<void>(resolve => {
            markDone = resolve;
        })
    );
    after(async () => {
        try {
            await task();
        } finally {
            markDone();
        }
    });
}
