/**
 * degrade 렌더의 revalidate를 낮추는 공용 핀 두 개. 같은 메커니즘(렌더 중 짧은 `revalidate`의
 * `unstable_cache`를 불러 렌더 스토어 값을 낮춘다 — 아래 `pin*` 주석)을 쓰되 **값과 쓰임이 다르다**:
 *
 * 1. **빌드타임 핀 — 60초**(`BUILD_DEGRADED_REVALIDATE_SECONDS`). 빌드가 degrade된 채로 구워진 HTML이
 *    배포 후 첫 요청에서 곧 실데이터로 재생성되게 한다.
 *    - FMP 실패(회로 열림 / `FMP_AT_BUILD=off`) — `shortenRevalidateIfFmpFailedAtBuild`
 *    - DB 없는 빌드(배포 빌드의 사설 RDS) — `shortenRevalidateIfDatabaseMissingAtBuild`
 *    - 판정이 이미 끝난 호출부용 무조건 변형 — `shortenRevalidateForBuildDegrade`
 * 2. **런타임 핀 — 300초**(`RUNTIME_DEGRADED_REVALIDATE_SECONDS`). 큐레이션 종목의 런타임 읽기 실패
 *    (봉·스냅샷·뉴스 카테고리 목록) 렌더가 6~24h 굳지 않게 한다 — `shortenRevalidateForRuntimeDegrade`.
 *    provider 지속 장애(예: FMP 402)를 매분 다시 부르지 않으려 빌드 값보다 길다.
 *
 * 원인별 판정은 각 호출부가 맡고, 이 파일은 "이번 렌더의 revalidate를 N초로"만 책임진다.
 */
import 'server-only';
import { unstable_cache } from 'next/cache';
import { isFmpUnavailableAtBuild } from '@/shared/api/offlineBuild';
import { SECONDS_PER_HOUR } from '@/shared/config/time';
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

/**
 * 세션 키 캐시가 **한 세션 뒤처진 값**(`sessionCoverage` = `lagging`)을 받은 렌더의 revalidate(초).
 *
 * 그 값은 캐시에 저장하지 않지만, 렌더된 ISR HTML은 라우트 revalidate(12~24h) 동안 남는다 — 그대로
 * 두면 직전 세션 데이터가 그만큼 굳는다(예전 6h 봉 캐시 시절보다 나쁘다). 그래서 이 렌더만 짧게 한다.
 *
 * 300초(`RUNTIME_DEGRADED_REVALIDATE_SECONDS`)가 아니라 1h인 이유: `lagging`은 장애가 아니라
 * 흔한 상태다 — 그날 체결이 없던 저유동 종목은 다음 세션 롤까지 내내 `lagging`이고, 롱테일까지
 * 포함한 전 종목이 대상이다. 5분이면 그런 종목의 탭마다 하루 수백 번 재생성한다. provider EOD
 * 발행 지연·허브 Redis(1h) 갱신 대기는 대부분 1h 안에 풀리므로, 1h면 옛 6h 봉 캐시보다 빠르게
 * 따라잡으면서 재생성 비용은 탭당 하루 최대 24회로 묶인다.
 */
export const INCOMPLETE_SESSION_REVALIDATE_SECONDS = SECONDS_PER_HOUR;

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

const pinIncompleteSessionRevalidate = unstable_cache(
    async () => true,
    ['incomplete-session-revalidate'],
    { revalidate: INCOMPLETE_SESSION_REVALIDATE_SECONDS }
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
export async function shortenRevalidateForBuildDegrade(): Promise<void> {
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
    // 핀은 **최선 노력**이다 — 실패해도 호출부(degrade 처리 중인 catch 블록)를 던지게 만들면 안 된다.
    // 호출부는 이미 원래 에러를 처리하는 중이라, 여기서 던진 에러가 그 에러를 덮어쓰고 degrade가
    // 500이 된다. 던질 수 있는 경로는 Next 렌더/라우트 컨텍스트 밖(`incrementalCache` 없음 —
    // `unstable-cache.js`의 `Invariant: incrementalCache missing`)뿐이다. 페이지 렌더 안에서는 아무
    // 일도 일어나지 않고, 라우트 핸들러(`request` 스토어)·다른 `unstable_cache` 콜백 안(중첩)에서는
    // revalidate를 낮추지 못할 뿐 부작용이 없다(`unstableCacheRevalidateLowering.test.ts`).
    try {
        await pinRuntimeDegradedRevalidate();
    } catch (error) {
        console.warn(
            '[shortenRevalidateForRuntimeDegrade] pin skipped (outside a Next render?):',
            error
        );
    }
}

/**
 * 세션 키 캐시가 한 세션 뒤처진 값을 받은 렌더의 revalidate를 1h로 낮춘다
 * (`INCOMPLETE_SESSION_REVALIDATE_SECONDS`) — 큐레이션 여부와 무관하게 모든 종목에 쓴다.
 *
 * 쓰는 곳: `sessionBarsStaticCache`(헤더 칩·공포·탐욕·포지션 탭의 봉)와 종목 탭의 시장 공포·탐욕
 * 판독(`marketFearGreedReading`). 제약은 다른 핀과 같다 — 렌더 경로에서 불러야 하고, 다른
 * `unstable_cache` 콜백 안에서는 효과가 없다. 실패는 삼킨다(호출부 렌더를 깨뜨리지 않는다).
 */
export async function shortenRevalidateForIncompleteSession(): Promise<void> {
    try {
        await pinIncompleteSessionRevalidate();
    } catch (error) {
        console.warn(
            '[shortenRevalidateForIncompleteSession] pin skipped (outside a Next render?):',
            error
        );
    }
}
