/**
 * 빌드타임 degrade 렌더의 revalidate를 60초로 낮추는 공용 핀.
 *
 * 두 가지 원인이 같은 메커니즘을 쓴다:
 *  - FMP 실패(회로 열림 / `FMP_AT_BUILD=off`) — `shortenRevalidateIfFmpFailedAtBuild`
 *  - DB 없는 빌드(배포 빌드의 사설 RDS) — `shortenRevalidateIfDatabaseMissingAtBuild`,
 *    그리고 판정이 이미 끝난 호출부용 무조건 변형 `shortenRevalidateForDegrade`
 *
 * 원인별 판정은 각 함수가 맡고, 이 파일은 "이번 렌더의 revalidate를 60초로"만 책임진다.
 */
import 'server-only';
import { unstable_cache } from 'next/cache';
import { isFmpUnavailableAtBuild } from '@/shared/api/offlineBuild';
import { isDatabaseMissingAtBuild } from '@/shared/db/config';

/** FMP 실패·DB 부재로 degrade된 빌드타임 prerender의 revalidate(초). */
export const BUILD_DEGRADED_REVALIDATE_SECONDS = 60;

/**
 * 큐레이션 종목의 **런타임** degrade 렌더(봉·스냅샷·카테고리 목록 읽기 실패)의 revalidate(초).
 *
 * 빌드타임 값(60초)과 **일부러 다르다.** 런타임 degrade의 흔한 원인은 provider의 지속 장애(예: FMP
 * 402)인데, 60초면 장애 중인 provider를 종목마다 매분 다시 부른다. 5분이면 noindex 노출 창은
 * 여전히 옛 6~24시간에 비해 무시할 만하고 재호출 부하는 1/5이다.
 */
export const RUNTIME_DEGRADED_REVALIDATE_SECONDS = 300;

/*
 * 렌더 중 호출된 `unstable_cache`는 자기 `revalidate`가 더 짧으면 렌더 스토어의
 * revalidate를 그 값으로 낮춘다(next/dist/server/web/spec-extension/unstable-cache.js,
 * `prerender-legacy` 등 prerender 스토어 분기 — "store.revalidate = min", Next 16.3.6에서
 * 소스 확인 + 로컬 프로덕션 빌드로 실측). 공개 계약이 아닌 내부 동작이라
 * `src/__tests__/guards/unstableCacheRevalidateLowering.test.ts`가 분기 존재를 고정한다. 라우트의
 * `export const revalidate` 리터럴은 정적 분석 대상이라 조건부로 바꿀 수 없으므로,
 * 이 공개 API로 "이번 렌더만" 짧게 만든다. 반환값은 쓰지 않는다.
 *
 * ⚠️ 다른 `unstable_cache` 콜백 **안**에서 부르면 효과가 없다(중첩 unstable-cache
 * 스토어는 revalidate를 전파하지 않는다) — 페이지/레이아웃 렌더 경로에서 불러야 한다.
 */
const pinBuildDegradedRevalidate = unstable_cache(
    async () => true,
    ['build-degraded-revalidate'],
    { revalidate: BUILD_DEGRADED_REVALIDATE_SECONDS }
);

const pinRuntimeDegradedRevalidate = unstable_cache(
    async () => true,
    ['runtime-degraded-revalidate'],
    { revalidate: RUNTIME_DEGRADED_REVALIDATE_SECONDS }
);

/**
 * 빌드 중 FMP가 실패했으면(회로 열림 또는 `FMP_AT_BUILD=off`) 이 페이지의
 * revalidate를 60초로 낮춘다. 런타임 렌더와 정상 빌드에서는 아무것도 하지 않아
 * 라우트 고유 revalidate(market·fear-greed 3600, economy 86400)가 그대로 쓰인다.
 *
 * 효과: degrade된 빌드 HTML이 서빙되는 배포(파일시스템 ISR 캐시 — 로컬 `next start`,
 * S3 핸들러 미등록 self-host)에서 배포 후 첫 요청(warm-isr.sh·봇·사용자)이 60초 뒤
 * 실데이터로 재생성한다. S3 핸들러가 붙은 프로덕션은 GIT_SHA prefix가 비어 있어
 * 어차피 첫 요청이 런타임 렌더를 하므로, 거기서는 prerender-manifest의 초기값만
 * 60이 된다(인스턴스 기동 직후 한 번 더 재생성될 수 있는 정도의 비용).
 *
 * FMP 실패를 페이지별이 아니라 프로세스 단위 회로로 판정하므로, 회로가 열린 뒤
 * 렌더된 페이지는 자기 데이터가 멀쩡해도 60초가 될 수 있다 — 재생성 1회의 비용이라
 * 감수한다. 반드시 해당 페이지의 FMP 로더를 기다린 **뒤** 부른다(그래야 그 로더가
 * 연 회로가 보인다).
 */
export async function shortenRevalidateIfFmpFailedAtBuild(): Promise<void> {
    if (!isFmpUnavailableAtBuild()) return;
    await pinBuildDegradedRevalidate();
}

/**
 * DB 없이 도는 빌드(배포 빌드의 사설 RDS — `isDatabaseMissingAtBuild`)면 이 페이지의
 * revalidate를 60초로 낮춘다. 런타임과 DB가 있는 빌드에서는 아무것도 하지 않는다.
 *
 * DB를 읽는 모든 정적 prerender 라우트(`/economy`·`/economy/kr`·`/news`·`/news/us`·
 * `/symbols`)가 부른다. 이 라우트들은 DB 실패를 삼키고 빈/이름 없는 목록으로
 * degrade하는데(noindex이거나 티커만 찍힌다), 그 렌더가 라우트 고유 revalidate
 * (12h~24h)로 굳으면 배포 후 반나절~하루 동안 얇은 페이지가 나간다. 배포 직후
 * `scripts/warm-isr.sh`와 첫 요청이 60초 뒤 실데이터로 재생성한다.
 *
 * 같은 `unstable_cache` 래퍼를 쓰므로 `shortenRevalidateIfFmpFailedAtBuild`와 제약이
 * 같다 — 페이지/레이아웃 렌더 경로에서 불러야 하고, 다른 `unstable_cache` 콜백 안에서는
 * 효과가 없다.
 */
export async function shortenRevalidateIfDatabaseMissingAtBuild(): Promise<void> {
    if (!isDatabaseMissingAtBuild()) return;
    await pinBuildDegradedRevalidate();
}

/**
 * 호출한 이 렌더의 revalidate를 무조건 60초로 낮춘다 — **빌드타임** degrade, 판정이 이미 끝난
 * 호출부용(예: 배포 빌드에 DB가 없어 `/terms`·`/privacy`가 안내문 fallback으로 구워지는 경우).
 *
 * 런타임 degrade는 이 함수가 아니라 `shortenRevalidateForRuntimeDegrade`(300초)를 쓴다.
 *
 * "이게 degrade인가" 판정은 호출부 몫이다. 같은 `unstable_cache` 래퍼 방식이라
 * `shortenRevalidateIfFmpFailedAtBuild`와 동일한 제약이 붙는다: 다른 `unstable_cache` 콜백 안에서
 * 부르면 효과가 없고, 페이지/레이아웃 렌더 경로에서 불러야 한다.
 */
export async function shortenRevalidateForDegrade(): Promise<void> {
    await pinBuildDegradedRevalidate();
}

/**
 * 큐레이션 종목의 **런타임** degrade 렌더의 revalidate를 300초로 낮춘다
 * (`RUNTIME_DEGRADED_REVALIDATE_SECONDS`).
 *
 * 쓰는 곳: 큐레이션 종목의 봉·스냅샷 읽기 실패(`getBarsStatic`·`getSeoSnapshotsStatic`)와 뉴스
 * 카테고리 목록 읽기 실패. 라우트 고유 revalidate(6~24h) 그대로면 그 degraded noindex가 반나절 넘게
 * 굳는다. throw(500) 대신 이 핀을 쓰면 콜드 렌더에서 사람이 에러 화면을 보지 않고, 노출 창이 5분으로
 * 줄어든다. 60초가 아닌 이유는 `RUNTIME_DEGRADED_REVALIDATE_SECONDS` 주석 참고.
 *
 * 런타임 ISR에서도 동작한다 — Next 16.3 `unstable-cache.js`가 `prerender-legacy` 스토어의
 * `revalidate`를 더 짧은 값으로 낮춘다(`unstableCacheRevalidateLowering.test.ts`가 그 분기를
 * 고정한다). 페이지/레이아웃 렌더 경로에서 불러야 하고, 다른 `unstable_cache` 콜백 안에서는
 * 효과가 없다.
 */
export async function shortenRevalidateForRuntimeDegrade(): Promise<void> {
    await pinRuntimeDegradedRevalidate();
}
