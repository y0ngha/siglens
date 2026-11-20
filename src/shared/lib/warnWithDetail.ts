import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';

/**
 * `(message, detail?)` 로거의 `console.warn` 구현 — `detail`이 없으면 메시지만 남긴다. `console.warn(message, detail)`을 그대로
 * 부르면 `detail`이 없는 호출마다 줄 끝에 `undefined`(또는 `?? ''`면 빈 칸)가 붙어 로그 검색·메트릭 필터가 흐려진다.
 * 수집 cron의 `createDeps`와 수급 데이터 공급자가 주입하는 `log`가 이것을 쓴다. `detail`에 DB 에러가 오면 파라미터가
 * 새지 않도록 `redactDbErrorForLog`를 거친다(`SERVER.md#SA-26`: 주입된 로거는 가드가 못 보므로 싱크에서 막는다).
 */
export function warnWithDetail(message: string, detail?: unknown): void {
    if (detail === undefined) {
        console.warn(message);
        return;
    }
    console.warn(message, redactDbErrorForLog(detail));
}
