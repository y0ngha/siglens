/**
 * pre-push 로컬 빌드가 프로덕션 FMP/Neon/Upstash/Yahoo에 닿지 않도록 막는 게이트.
 *
 * WHY: 로컬 `yarn build`는 `.env.local`(프로덕션 자격증명)을 그대로 로드한 채
 * `/economy`, `/market`(us/kr), `/fear-greed`(us/kr), `news/[category]`, 법적 페이지,
 * 홈을 prerender하며 실제 FMP/Neon/Upstash/Yahoo를 호출한다. 이 출력은 버려지므로
 * degrade된 결과라도 무해하다 — 문제는 프로덕션 서비스에 불필요한 부하/비용을 주는
 * 쪽이다. Yahoo는 API 키가 없어 FMP처럼 자격증명 부재로 자연히 막히지 않으므로
 * (한국 market/fear-greed 라우트가 `marketDataProviderFor('kr')`로 타는 경로),
 * 이 게이트가 없으면 매 빌드마다 실제 요청이 나간다.
 *
 * `SIGLENS_OFFLINE_BUILD=1`은 `.husky/pre-push`만 설정한다. Docker 배포 빌드는
 * ISR S3 캐시가 GIT_SHA별이라 반대로 실데이터가 반드시 필요하므로 이 플래그를
 * 절대 켜면 안 된다(`Dockerfile` / `.github/workflows/deploy.yml`에 추가 금지).
 *
 * 각 호출부(FMP/Neon/Upstash/Yahoo 어댑터)는 이 서비스들이 unreachable일 때 이미
 * graceful하게 degrade하도록 되어 있으므로(캐시 미스/빈 배열/null 반환), 여기서는
 * 네트워크 호출 자체를 사전에 막기만 하면 된다.
 *
 * **Yahoo는 fetch 레벨이 아니라 메서드 레벨에서 막아야 한다**: `createYahooClient`가
 * 반환하는 클라이언트를 Proxy로 감싸 `quote`/`chart`/`search` 등 호출 자체를 가로챈다.
 * `quote`는 내부적으로 crumb/cookie를 먼저 받아오는 별도 경로를 타는데, 그 경로에서
 * fetch가 throw하면 공유 promise가 영영 안 풀린 채 남아 이후 모든 `quote` 호출이
 * 함께 멈춘다(실측: `SIGLENS_OFFLINE_BUILD=1` + `.env.local` 상태에서 `/market/kr`
 * prerender가 60초 타임아웃에 3번 연속 걸림). fetch 레벨 가드만으로는 이 hang을 막지
 * 못하므로 백스톱으로만 남겨 둔다.
 *
 * **`@y0ngha/siglens-core`는 이 게이트를 우회한다**: `getSectorSignals` 등 core가
 * 직접 만드는 Upstash 캐시 클라이언트는 이 모듈을 거치지 않고 `process.env`의
 * `UPSTASH_REDIS_REST_URL`/`_TOKEN`을 곧바로 읽는다. 그래서 `.husky/pre-push`가
 * `SIGLENS_OFFLINE_BUILD=1`과 별개로 저 두 변수를 빈 문자열로 선점해 core의 Upstash
 * 접근도 함께 끈다(Next의 `loadEnvConfig`는 이미 프리셋된 env를 `.env.local` 값으로
 * 덮어쓰지 않는다).
 */
export function isOfflineBuild(): boolean {
    return process.env.SIGLENS_OFFLINE_BUILD === '1';
}

/** 이 게이트가 차단하는 서비스 이름. 문자열 리터럴 중복을 막기 위한 단일 출처. */
export const OFFLINE_BUILD_SERVICE = {
    FMP: 'FMP',
    DATABASE: 'Database',
    UPSTASH: 'Upstash',
    YAHOO: 'Yahoo',
} as const;

export type OfflineBuildService =
    (typeof OFFLINE_BUILD_SERVICE)[keyof typeof OFFLINE_BUILD_SERVICE];

const warnedServices = new Set<OfflineBuildService>();

/**
 * 서비스별로 프로세스당 한 번만 `[offline-build]` 경고를 남긴다.
 *
 * 각 어댑터가 차단 에러를 캐치해 조용히 degrade하므로, 에러 메시지만으로는
 * 빌드 로그에 어떤 서비스가 실제로 차단됐는지 드러나지 않는다. 이 헬퍼가 그
 * 가시성을 담당한다.
 */
export function warnOfflineBuildOnce(service: OfflineBuildService): void {
    if (warnedServices.has(service)) return;
    warnedServices.add(service);
    console.warn(`[offline-build] blocking ${service} request`);
}

/**
 * offline build일 때만 경고 후 `[offline-build] blocked <service> request to
 * <detail>` 에러를 던지는 공용 가드. online이면 아무 일도 하지 않는다.
 *
 * FMP(`fmpGet`)/Yahoo(`createYahooClient`)/Neon(`getDatabaseClient`)처럼 "차단 시
 * 항상 throw"하는 호출부 전용이다. FMP 검색(`fetchFmpEndpoint`)처럼 lenient 모드가
 * 있는 호출부는 이 헬퍼를 throw가 필요한 분기에서만 쓰고, 빈 배열/null로 degrade하는
 * 분기는 `warnOfflineBuildOnce`를 직접 호출한다.
 */
export function assertOnline(
    service: OfflineBuildService,
    detail: string
): void {
    if (!isOfflineBuild()) return;
    warnOfflineBuildOnce(service);
    throw new Error(`[offline-build] blocked ${service} request to ${detail}`);
}

/** @internal 테스트 간 `warnOfflineBuildOnce`의 프로세스 메모를 초기화한다. */
export function __resetOfflineBuildWarningsForTests(): void {
    warnedServices.clear();
}

/**
 * `next build`(prerender) 단계인가. Next가 빌드 시작 시 메인 프로세스에
 * `NEXT_PHASE=phase-production-build`를 심고(next/dist/build/index.js) 정적 생성
 * 워커는 그 env를 물려받는다. `next start`/standalone 런타임에는 설정되지 않는다.
 * `cache-handler/config.mjs`의 `buildPhase`와 같은 판정이다 — 그 파일은 번들 밖(.mjs)이라
 * 이 함수를 import하지 못한다. 바꾸면 두 곳을 함께 바꾼다.
 */
export function isBuildPhase(): boolean {
    return process.env.NEXT_PHASE === 'phase-production-build';
}

/**
 * 빌드 중 FMP 정책 — `FMP_AT_BUILD` env(Dockerfile ARG ← deploy.yml build-arg).
 *
 * WHY: 배포 빌드가 `/market`(섹터 스캔 ~255 calls)·`/economy`·`/fear-greed`·
 * `/fear-greed/crypto`를 prerender하며 FMP를 몰아 부른다. FMP가 429를 주면 `fmpGet`의
 * 런타임 재시도(10s→15s→20s)가 페이지 하나를 Next prerender 타임아웃(60s) 너머로
 * 밀고, 3회 재시도 후 `prerenderEarlyExit`로 빌드 전체가 죽었다(v0.94.0 배포 2회 실패).
 * 모든 호출부는 이미 catch해 degrade하므로 빌드 중엔 "빨리 실패"가 정답이다.
 *
 *   - `off`: 빌드 중 FMP 요청을 아예 보내지 않는다(FMP가 배포를 막고 있을 때의 스위치).
 *   - 그 외(미설정/`best-effort`): 시도는 하되 재시도 없이 실패하고, 첫 transient
 *     실패(429·5xx·타임아웃·네트워크)에서 회로를 열어 이후 호출을 요청 없이 실패시킨다.
 *
 * 런타임(빌드 단계가 아님)에는 이 정책이 전혀 개입하지 않는다.
 *
 * 회로 상태는 모듈 전역 = **프로세스 단위**다. Next의 정적 생성 워커는 별도 프로세스라
 * 워커마다 첫 실패를 한 번씩 겪고 각자 회로를 연다(빌드 전체로 최대 워커 수만큼의 429).
 */
let fmpBuildBreakerOpen = false;

function isFmpOffAtBuild(): boolean {
    return process.env.FMP_AT_BUILD === 'off';
}

/**
 * 이 빌드 프로세스에서 FMP가 더는 쓸 수 없는 상태인가(빌드 단계 + `off` 또는 회로 열림).
 * true면 이 프로세스의 prerender 결과가 FMP 실패로 degrade됐을 수 있다는 뜻이다.
 */
export function isFmpUnavailableAtBuild(): boolean {
    return isBuildPhase() && (isFmpOffAtBuild() || fmpBuildBreakerOpen);
}

/**
 * 빌드 중 FMP를 쓸 수 없으면 즉시 던진다. `fmpGet`은 요청 전에, FMP 실패를 삼키는
 * `unstable_cache` 콜백은 반환 직전에 불러 degrade된 값이 Data Cache에 굳지 않게 한다.
 */
export function assertFmpAvailableAtBuild(detail: string): void {
    if (!isFmpUnavailableAtBuild()) return;
    const reason = isFmpOffAtBuild() ? 'FMP_AT_BUILD=off' : 'breaker open';
    throw new Error(
        `[build-fmp] FMP unavailable at build (${reason}): ${detail}`
    );
}

/** 빌드 중 첫 transient FMP 실패에서 회로를 연다. 로그는 프로세스당 한 번. */
export function tripFmpBuildBreaker(detail: string, error: unknown): void {
    if (fmpBuildBreakerOpen) return;
    fmpBuildBreakerOpen = true;
    const cause = error instanceof Error ? error.message : String(error);
    console.warn(
        `[build-fmp] breaker tripped on ${detail} (${cause}) — remaining FMP calls in this build process fail fast`
    );
}

/** @internal 테스트 간 빌드 FMP 회로를 닫는다. */
export function __resetFmpBuildBreakerForTests(): void {
    fmpBuildBreakerOpen = false;
}
