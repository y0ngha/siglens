// 작은 FETCH 엔트리 전용 프로세스 내 캐시 (bounded LRU).
//
// ## 크기로 가르는 이유 — 실측 분포가 이봉이다
//
// 2026-08 실측, 빌드 prefix 0.58.0의 `fetch/` 객체 12,334개 / 128.4MB:
//
//     p50 0.2KB · p75 0.5KB · p90 26.4KB · p95 103KB · p99 122KB · max 698KB
//     ≤8KB   → 객체의 88%,  용량의  3%
//     ≤128KB → 객체의 99%,  용량의 95%
//
// **S3 PUT 요청비는 개수가 만들고, 개수는 8KB 이하가 만든다**(객체 88%, 용량 3%).
// 반대로 비싼 엔트리 — `getBarsStatic`의 `bars-static:*`(지표 포함 수백 KB),
// 큰 `unstable_cache` JSON — 는 소수인데 용량의 97%를 쥔다. 그것들은 재생성이 비싸고
// 인스턴스 간 공유가 실제로 값을 하므로 **S3에 그대로 둔다**.
//
// 그래서 이 맵이 담는 건 `MEM_ROUTE_MAX_BYTES` 이하 엔트리뿐이다. (위 분포의 8KB는
// **gzip된 S3 객체** 기준이고, 게이트는 압축 전 본문 길이를 잰다 — 아래 상수 주석 참고.)
// 2026-08에는 상주 ~4MB로 축출이 거의 없을 거라 봤지만 2026-10 실측은 개수 상한(2만)에
// 상시 붙어 하루 ~14만 건 축출(적중률 26%)이었다. 그래서 게이트·예산·개수를 넓혔고, 지금
// 기대치는 "바이트 예산(64MB)이 먼저 걸리는지"를 `fetch-mem` 로그(size·bytes·evicted)로
// 확인해야 하는 가정이다.
//
// ## FETCH는 `fmpGet`만이 아니다
//
// Next의 `unstable_cache`도 `kind: FETCH`로 쓴다
// (next/dist/server/web/spec-extension/unstable-cache.js). 즉 이 계층에는 FMP 응답뿐
// 아니라 앱의 `unstable_cache` L2 전체가 섞여 있고, 그중에는 Redis가 아니라 **DB**를
// 백엔드로 쓰는 것들이 있다(`peekAnalysisStaticCache`, `getCalendarFromDb`,
// `sitemap-entry/server.ts`, `resolveIndicatorLabels`, `getKrIndicatorCards`,
// `getAssetInfoStatic`). 이것들은 Redis가 막아주지 않으므로 메모리로 강등하면
// 재시작·스케일아웃마다 DB 쿼리가 늘어난다 — 크기 게이트가 그 위험을 큰 엔트리에서
// 걷어내고, 남는 작은 엔트리는 재생성이 싸다. (S3 키에 빌드 ID가 들어가 배포를 넘어
// 공유된 적은 원래 없으므로, 메모리로 옮겨 잃는 건 같은 빌드 안의 인스턴스 간 공유뿐이다 —
// 스케일아웃·교체 때 인스턴스당 DB 조회 1회로, 대신 나가던 S3 GET 1회와 비용이 비슷하다.)
//
// ## next.config.ts의 `cacheMaxMemorySize: 0`과 무관
//
// 그 설정은 Next 기본 `FileSystemCache`만 소비한다(file-system-cache.js). 커스텀
// 핸들러가 등록된 프로덕션에서는 이미 no-op이다. 이 맵은 핸들러 **안쪽**이라
// `index.mjs`의 태그 검사(`ensureTagsFresh` + `maxRevalidatedAt`)를 그대로 통과한다 —
// 무효화 의미론은 저장소와 무관하게 동일하다.
//
// ## 한계
//
// 인스턴스 로컬이고 재시작이면 비워진다. 담는 대상이 작고 재생성이 싼 엔트리로
// 한정돼 있어 허용 가능하다. 라우팅 판단과 S3 폴백은 `index.mjs`가 한다.

/**
 * 양의 유한값만 받고 나머지는 기본값으로 떨어뜨린다.
 *
 * `Number(x) || fallback`으로 쓰면 안 된다 — 음수는 truthy라 그대로 통과하고,
 * 그러면 `evictToFit`의 `store.size <= MAX_ENTRIES` 조건이 영구히 거짓이 되어
 * **매 set마다 맵 전체가 비워진다**. 캐시는 죽었는데 에러도 로그도 없다.
 */
function readPositiveBound(name, fallback) {
    const raw = Number(process.env[name]);
    return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

// 메모리로 보낼 엔트리의 크기 상한 = S3와의 분기점. 초과분은 `setEntry`가 거부하고
// `index.mjs`가 S3로 보낸다.
//
// **단위에 주의.** 위 분포(8KB에서 객체 88% / 용량 3%)는 S3 객체, 즉 v8 직렬화 후
// **gzip된** 크기다. 반면 이 게이트는 `approximateBytes`로 **압축 전 본문 길이**를 잰다
// (`fetch()` 본문은 base64라 원본의 1.33배다). 예전에 8KB를 그대로 썼을 때 압축 후
// 2KB짜리 엔트리도 S3로 가서 PUT·GET이 늘었다(2026-10 감사: S3 GET의 ~90%가 FETCH miss).
// JSON의 gzip 압축률이 대략 1/4~1/6이라 압축 전 32KB ≈ 압축 후 6~8KB로, 원래 의도한
// 분기점에 맞춘다. 바이트 예산(아래)이 상주량을 따로 묶으므로 상한을 올려도 힙은 안전하다.
export const MEM_ROUTE_MAX_BYTES = readPositiveBound(
    'ISR_FETCH_CACHE_ROUTE_MAX_BYTES',
    32 * 1024
);

// 엔트리 수 상한. 2026-08 실측(소형 ~10,850개)으로 20,000을 잡았지만 2026-10에는 상한에
// 상시 붙어 하루 ~14만 건을 축출했다(적중률 26%, 계상 ~7MB) — 크롤 범위가 넓어진 탓이다.
// 운영값은 SSM `/siglens/ISR_FETCH_CACHE_MAX_ENTRIES`(2026-10: 100000)로 올렸고, 이 기본값은
// SSM이 없을 때의 하한이다. 실질 제동은 아래 바이트 예산이 건다.
const MAX_ENTRIES = readPositiveBound('ISR_FETCH_CACHE_MAX_ENTRIES', 20000);

// 총 바이트 상한. 컨테이너 메모리 상한이 걸려 있으므로(8aacd2b6 "앱 컨테이너 메모리
// 상한 2층 + 힙 고갈 알람") 개수만으로는 부족하다 — 큰 응답 몇 개가 힙을 먹는 걸 막는다.
//
// 64MB인 이유: 2026-08에는 게이트를 통과하는 엔트리 총량이 ~4MB라 32MB로 충분했지만,
// 개수 상한을 10만으로 올리고 게이트를 압축 전 32KB로 바로잡으면 상주량이 늘어난다
// (예전 게이트 기준 평균 0.35KB × 10만 ≈ 35MB만으로 32MB를 넘는다. 게이트를 넓혀 평균이
// 커지면 예산이 개수 상한보다 먼저 걸릴 수 있다 — 배포 후 `fetch-mem` 로그로 확인할 것).
// 계상은 본문 길이뿐이라 headers·url·tags·Map 노드를 더한 실제 상주는 10만 개에서
// +250~350MB까지 갈 수 있다. 2026-10-04 실측 컨테이너 610MiB / 상한 2.5GiB(`--memory`),
// 힙 한도 1536MB라 여유 안이다.
//
// `approximateBytes`가 본문 길이만 세고 headers/url/tags와 Map 노드 오버헤드는 빼므로
// **실제 상주 메모리는 계상값보다 크다**(한국어 JSON은 V8이 2바이트 문자열로 잡아
// 최대 2배). 64MB 예산이 가득 차면 본문만 ~128MB까지 상주할 수 있다(위 문단의 +250~350MB 추정 참고).
// 운영 중 조정은 SSM `/siglens/ISR_FETCH_CACHE_MAX_BYTES`로 가능하다(코드 변경 불필요).
// 하한이 `MEM_ROUTE_MAX_BYTES`인 이유: 두 값이 독립 env라 운영자가 총 예산을 라우팅
// 게이트보다 작게 잡을 수 있다. 그러면 게이트를 통과한 엔트리가 삽입 직후 `evictToFit`에
// 즉시 축출돼 **캐시가 조용히 no-op**이 된다(히트율 0%, 에러 없음). 최소 1개는 담기게 한다.
const MAX_TOTAL_BYTES = Math.max(
    readPositiveBound('ISR_FETCH_CACHE_MAX_BYTES', 64 * 1024 * 1024),
    MEM_ROUTE_MAX_BYTES
);

// 킬 스위치. `true`면 이 계층을 통째로 우회한다 — `getEntry`는 항상 miss를 돌려주고
// `setEntry`는 항상 거부해서, `index.mjs`가 FETCH 엔트리를 예전처럼 **전부 S3로** 보낸다.
//
// `ISR_CACHE_DISABLED`와 다르다: 그건 페이지 캐싱까지 죽여 순수 SSR로 강등시킨다.
// 이건 FETCH 메모리 계층만 되돌리므로, 이 변경이 의심될 때 재배포 없이
// SSM `/siglens/ISR_FETCH_CACHE_DISABLED=true` + 인스턴스 갱신으로 원복할 수 있다.
// **호출 시점**에 읽는다. 모듈 로드 시 상수로 굳히면 테스트가 "껐다"와 "아직 안 채웠다"를
// 구분할 수 없고(env를 바꾸려면 모듈을 다시 임포트해야 하는데 그러면 Map도 비워진다),
// 2026-08 감사가 뮤테이션으로 그 테스트가 무효임을 증명했다. 운영상으로도 이쪽이 낫다 —
// SSM 값을 바꾸고 프로세스만 재시작하면 되는 게 아니라, 원래 의도대로 즉시 반영된다.
function isDisabled() {
    return process.env.ISR_FETCH_CACHE_DISABLED === 'true';
}

// 상태 로그 간격.
const STATS_LOG_INTERVAL_MS = 5 * 60 * 1000;

// 상태 로그 이벤트 이름. infra/aws/07-alarms.sh의 JSON 메트릭 필터
// `{ $.event = "fetch-mem" }`가 이 값을 매칭한다 — 바꾸면 알람도 함께 고칠 것.
const STATS_EVENT = 'fetch-mem';

/** @type {Map<string, { entry: unknown, bytes: number }>} */
const store = new Map();
let totalBytes = 0;
let hits = 0;
let misses = 0;
let evictions = 0;
// 0 = 아직 로그 없음 → 프로세스 부팅 후 첫 접근에서 즉시 한 줄 남긴다(생존 확인).
let lastStatsLogAt = 0;

/**
 * 주기적으로 캐시 상태를 남긴다.
 *
 * 이게 없으면 이 캐시의 모든 고장이 조용하다 — 히트율 0%, 축출 스래싱, 예산 드리프트
 * 어느 것도 밖에서 보이지 않고, 증상은 FMP 요금과 Upstash 커맨드 수로만 뒤늦게 나타난다.
 */
function logStatsThrottled() {
    const now = Date.now();
    if (now - lastStatsLogAt < STATS_LOG_INTERVAL_MS) return;
    lastStatsLogAt = now;
    // **JSON이어야 한다.** CloudWatch 공백 구분 필터(`[a, b, size, ...]`)는 토큰을
    // 공백으로만 쪼개므로 `size=12` 같은 key=value는 통째로 한 토큰이 된다 —
    // `metricValue=$size`가 "size=12"를 숫자로 못 읽어 **아무것도 발행하지 않는다**.
    // JSON 필터(`{ $.event = "fetch-mem" }` + `metricValue=$.evicted`)는 값만 정확히 뽑는다.
    console.log(
        JSON.stringify({
            tag: 'isr-cache',
            event: STATS_EVENT,
            size: store.size,
            bytes: totalBytes,
            hit: hits,
            miss: misses,
            evicted: evictions,
        })
    );
}

/**
 * 엔트리 크기 근사. Next 16.2 `CachedFetchValue`는 본문을 `data.body`(문자열)에
 * 담으므로(response-cache/types.d.ts: CachedFetchValue.data.body) 그 길이가 지배적이다.
 * 정확한 바이트가 아니라 **예산 산정용 근사**다 — 여기서 JSON.stringify로 실측하면
 * 모든 write가 전체 페이로드를 한 번 더 직렬화하게 되어 배보다 배꼽이 커진다.
 */
function approximateBytes(entry) {
    const body = entry?.value?.data?.body;
    return typeof body === 'string' ? body.length : 1024;
}

/** 상한 아래로 내려갈 때까지 가장 오래된 항목부터 제거한다(Map은 삽입 순서 보존). */
function evictToFit() {
    for (const [key, held] of store) {
        if (store.size <= MAX_ENTRIES && totalBytes <= MAX_TOTAL_BYTES) return;
        store.delete(key);
        totalBytes -= held.bytes;
        evictions += 1;
    }
}

export function getEntry(key) {
    if (isDisabled()) return null;
    logStatsThrottled();
    const held = store.get(key);
    if (held === undefined) {
        misses += 1;
        return null;
    }
    hits += 1;
    // LRU: 재삽입으로 최근 사용 항목을 순서 끝으로 민다.
    store.delete(key);
    store.set(key, held);
    return held.entry;
}

/**
 * 엔트리를 받아들이면 `true`, 크기 게이트를 넘어 거부하면 `false`.
 *
 * 거부는 "이 값을 메모리에 두지 않는다"는 뜻일 뿐 "이 키를 비운다"가 아니다 —
 * 기존 엔트리는 보존한다. 거부된 키를 S3로 보내고 메모리 사본을 정리하는 책임은
 * 호출부(`index.mjs`)에 있다.
 */
export function setEntry(key, entry) {
    // 거부하면 index.mjs가 S3로 보낸다 — 킬 스위치가 곧 "전부 S3" 복귀다.
    if (isDisabled()) return false;
    // read 경로에서만 호출하면 쓰기 전용 프로세스(cron 등)가 영원히 로그를 안 남긴다.
    logStatsThrottled();
    const bytes = approximateBytes(entry);
    // 게이트 검사가 **먼저**다. 기존 항목을 먼저 지우면, 같은 키에 큰 값을 쓸 때
    // 예산 안에 있던 멀쩡한 옛 엔트리까지 쓰지도 않고 날려버린다.
    if (bytes > MEM_ROUTE_MAX_BYTES) return false;

    // 덮어쓰기면 옛 크기를 예산에서 뺀 뒤 재삽입한다(삭제 없이 set만 하면 삽입 순서가
    // 유지돼 LRU가 갱신되지 않는다).
    const prev = store.get(key);
    if (prev !== undefined) {
        store.delete(key);
        totalBytes -= prev.bytes;
    }

    store.set(key, { entry, bytes });
    totalBytes += bytes;
    evictToFit();
    return true;
}

/** 키를 제거한다. 같은 키가 S3로 승격될 때 낡은 메모리 사본을 지우는 용도. */
export function deleteEntry(key) {
    const held = store.get(key);
    if (held === undefined) return;
    store.delete(key);
    totalBytes -= held.bytes;
}

/** 테스트 격리용 — 맵과 예산을 초기화한다. */
export function __resetForTests() {
    store.clear();
    totalBytes = 0;
    hits = 0;
    misses = 0;
    evictions = 0;
    lastStatsLogAt = 0;
}

/** 테스트/진단용 현재 상태. */
export function statsForTest() {
    return { size: store.size, totalBytes };
}

/** 테스트용 카운터 — 로그 한 줄에 담기는 값과 동일하다. */
export function countersForTest() {
    return { hits, misses, evictions };
}
