import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * 페이지 렌더 경로 표식. 이 안에서 시작된 외부 호출(FMP 등)은 **짧은 예산**을 쓴다.
 *
 * ## 왜 필요한가
 *
 * `fmpGet`의 기본 재시도 정책(`FMP_TRANSIENT_RETRY`)은 배치 작업(cron·prewarm)에 맞춰져
 * 있다 — 시도당 10초 timeout, 최대 3회 재시도, 429면 10/15/20초 대기, 백오프 예산 60초.
 * 같은 정책이 ISR 렌더 안에서 돌면 FMP 하나가 느려질 때 cold render 한 번이 45~70초를
 * 붙잡는다(2026-10 서버 성능 감사 M6). 방문자·Googlebot은 그동안 아무것도 못 받고,
 * 렌더가 끝나도 결과는 어차피 degrade다.
 *
 * 렌더 경로에서는 "빨리 포기하고 degrade, 다음 재생성에 다시 시도"가 맞다. 각 렌더
 * 캐시 래퍼(`staticSymbolCache` 등)가 데이터 호출을 이 표식 안에서 실행하고,
 * `fmpGet`이 표식을 보고 렌더 예산 정책을 고른다.
 *
 * ## 왜 AsyncLocalStorage인가
 *
 * 렌더 경로의 FMP 호출은 provider·Redis read-through(`getOrSetCache`)·`React.cache`를
 * 몇 겹 거친 뒤에야 `fmpGet`에 닿는다. 옵션 인자로 끝까지 실어 나르면 그 사이 모든
 * 시그니처를 바꿔야 하고, 한 곳만 빠뜨려도 조용히 긴 정책으로 돌아간다. ALS는
 * 프라미스 체인을 따라 전파되므로 진입점(캐시 래퍼)만 표시하면 된다.
 *
 * ## 배치 작업은 렌더 예산 밖이다
 *
 * cron(`/api/cron/*`)은 진입점에서 {@link runAsBatchWork}로 감싼다. 배치 표식은 렌더 표식보다
 * **우선한다** — 배치 안에서 렌더 래퍼(`getAssetInfoStatic` 등)를 불러도 {@link runWithRenderBudget}이
 * 표식을 덮지 않으므로, 그 아래 FMP 호출은 배치용 정책(긴 timeout·429 대기)을 그대로 쓴다.
 * 같은 표식을 Redis 클라이언트 선택(`redisClient.ts`)도 읽는다 — 배치는 긴 명령 timeout을 쓴다.
 *
 * ## 알고 쓸 것
 *
 * - **프로세스 로컬 dedup과 엮인다.** `getOrSetCache`의 in-flight 공유나 provider의
 *   `React.cache`는 먼저 시작한 호출자의 정책을 나머지에게 적용한다. 렌더 예산으로 시작한
 *   fetch에 cron이 합류하면 cron도 짧은 예산의 결과(실패 포함)를 받고, 반대도 마찬가지다.
 *   받아들이는 이유: 합류는 같은 키를 같은 순간에 읽을 때만 생기고, 실패는 어느 캐시에도
 *   저장되지 않아(`getOrSetCache`는 throw 시 쓰지 않는다) 다음 호출이 자기 정책으로 다시 읽는다.
 *   `getOrSetCache.renderBudget.test.ts`가 이 동작을 고정한다.
 * - **배포 직후 `scripts/warm-isr.sh`는 HTTP로 페이지를 렌더한다** — 그건 진짜 렌더라 렌더
 *   예산을 쓴다. 예산 때문에 degrade된 렌더는 revalidate가 짧아져(호출부의
 *   `shortenRevalidateForRuntimeDegrade`) 곧 다시 생성된다.
 */
type BudgetMode = 'render' | 'batch';

const budgetStorage = new AsyncLocalStorage<BudgetMode>();

/**
 * `fn`과 그 안에서 시작되는 모든 비동기 작업을 렌더 예산 아래에서 실행한다.
 * 이미 {@link runAsBatchWork} 안이면 배치 표식을 유지한다(배치가 우선).
 */
export function runWithRenderBudget<T>(fn: () => Promise<T>): Promise<T> {
    if (budgetStorage.getStore() === 'batch') return fn();
    return budgetStorage.run('render', fn);
}

/** cron 등 배치 작업 진입점용. 안에서 만나는 렌더 래퍼의 예산 표식을 무시하게 한다. */
export function runAsBatchWork<T>(fn: () => Promise<T>): Promise<T> {
    return budgetStorage.run('batch', fn);
}

/** 현재 비동기 컨텍스트가 렌더 예산 아래인지. */
export function isRenderBudgetActive(): boolean {
    return budgetStorage.getStore() === 'render';
}

/** 현재 비동기 컨텍스트가 {@link runAsBatchWork} 안인지. */
export function isBatchWork(): boolean {
    return budgetStorage.getStore() === 'batch';
}
