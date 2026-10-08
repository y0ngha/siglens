import { unstable_noStore } from 'next/cache';
import type { Logger } from 'drizzle-orm/logger';

/**
 * 쿼리가 나갈 때마다 `unstable_noStore()`를 불러 "이 렌더는 DB를 읽는다"는 신호를
 * Next에 보내는 drizzle 로거.
 *
 * ## 왜 필요한가
 *
 * 예전 `drizzle-orm/neon-http`는 Next가 패치한 전역 `fetch`에 `cache: 'no-store'`로
 * 쿼리를 실어 보냈다. 코드베이스는 그 부수효과 두 가지에 기대고 있다
 * (`src/app/CLAUDE.md` 축 1, `getCalendarFromDb.ts`·`resolveIndicatorLabels.ts`).
 *
 *   1. `unstable_cache` **밖**의 정적 생성 중 DB 읽기는 `DYNAMIC_SERVER_USAGE`를 던지고
 *      라우트가 `revalidate = 0`(동적)으로 표시된다 — 실수로 DB 읽기를 캐시 없이 정적
 *      페이지에 박는 것을 빌드/ISR 단계에서 잡아 주는 안전망이다.
 *   2. `unstable_cache` **안**에서는 무해하게 통과한다.
 *
 * `postgres`(postgres-js)는 TCP 소켓을 직접 열어 `fetch`를 쓰지 않으므로 두 신호가
 * 조용히 사라지고, 위 안전망 없이 라우트가 정적으로 바뀔 수 있다(= 렌더 모드 변화).
 * 그래서 쿼리 직전에 같은 신호를 직접 보낸다.
 *
 * ## 왜 `unstable_noStore`로 대체되는가 (next@16.3.8 소스로 확인)
 *
 * `unstable_noStore` → `markCurrentScopeAsDynamic`:
 *   - `cache` / `unstable-cache` 스코프: 아무 일도 하지 않고 반환 (= 신호 2).
 *   - `prerender-legacy`: `revalidate = 0` 설정 후 `DynamicServerError` throw
 *     (= no-store fetch가 타던 경로, 신호 1).
 *   - Next 요청 스코프 밖(스크립트·테스트·`workAsyncStorage` 없음): 즉시 반환.
 *
 * ## 호출 시점 (drizzle-orm@0.45 `postgres-js/session.js`로 확인)
 *
 * `PostgresJsPreparedQuery.execute()`/`all()`과 `PostgresJsSession.query()`가 모두
 * `client.unsafe(...)`를 부르기 **전에 동기적으로** `logger.logQuery()`를 호출한다.
 * 트랜잭션도 같은 세션 클래스를 새로 만들면서 `this.options`(= logger)를 그대로 넘기므로
 * (`transaction()` 안의 `new PostgresJsSession(client, dialect, schema, this.options)`)
 * 트랜잭션 내부 쿼리도 같은 로거를 탄다. `DynamicServerError`가 던져지면 소켓에는
 * 아무것도 쓰이지 않은 채 execute의 promise가 reject된다.
 *
 * ## 부수효과 — 완전히 동일하지는 않다
 *
 * `unstable_noStore()`는 스코프 분기 **앞에서** `store.isUnstableNoStore = true`를 세팅한다
 * (`unstable-cache` 안에서도). 이 플래그는 `patch-fetch.js`만 읽고, 그것도
 * `fetchCache = 'default-cache'` 모드에서 config 없는 후속 fetch의 캐시 판정을 바꿀 때뿐이다.
 * no-store fetch는 이 플래그를 세팅하지 않았으므로 엄밀히는 새 부수효과다. 노출은 무시할 만하다:
 * `src`에 `fetchCache` export가 하나도 없고, config 없는 fetch는 `unstable_cache` 래퍼 안에서
 * 돈다. `fetchCache`를 도입하게 되면 이 로거의 영향을 같이 검토할 것.
 *
 * ## 한계
 *
 * 원시 `sql` 템플릿(`DatabaseClient['sql']`, 현재는 `/api/ready`만 사용)은 drizzle을
 * 거치지 않아 이 로거를 우회한다. 그 라우트는 `force-dynamic`이라 무관하지만, 정적
 * 렌더 경로에서 원시 `sql`을 쓰게 되면 위 안전망이 적용되지 않는다.
 */
export const noStoreQueryLogger: Logger = {
    logQuery() {
        unstable_noStore();
    },
};
