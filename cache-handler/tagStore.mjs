// 태그 무효화 스토어.
//
// 로컬 in-process Map이 read 경로의 유일한 소스다 — `maxRevalidatedAt`/`maxExpiredAt`은
// 동기 함수로 남으며 캐시 get마다 네트워크를 타지 않는다. 멀티 인스턴스 전파는 별도 경로로 붙는다:
//
//   write : revalidateTag → 로컬 Map 즉시 기록(read-your-writes) + Upstash 정렬셋에 durable 기록
//   read  : get()이 ensureTagsFresh()를 호출 → REFRESH_INTERVAL_MS 간격으로 "지난 sync 이후
//           변경된 태그만" 증분 조회(ZRANGE BYSCORE)해 로컬 Map에 병합(max)
//
// ## stale과 expired — 두 종류의 무효화
//
// Next 16 기본 FileSystemCache.revalidateTag(tags, durations)를 그대로 따른다
// (next/dist/server/lib/incremental-cache/file-system-cache.js:43-75):
//   - durations가 있으면(`revalidateTag(tag, 'max')` → `{ expire: 31536000 }`,
//     next/dist/server/revalidation-utils.js:119-123) **stale만** 찍는다 → 읽기 쪽은
//     엔트리를 버리지 않고 stale로 서빙하며 백그라운드 재생성(SWR)한다.
//   - durations가 없으면(`updateTag`, 단일 인자 `revalidateTag`) **expired**도 찍는다 →
//     읽기 쪽은 miss로 보고 블로킹 재생성한다.
// 그래서 로컬 맵이 둘이다: `revalidatedAt`(모든 무효화 = stale 기준)과 `expiredAt`(즉시 만료 무효화만).
//
// 원격 정렬셋에서는 같은 키 하나에 멤버 이름으로 구분한다 — 평문 `tag`는 stale,
// `EXPIRED_MEMBER_PREFIX + tag`는 expired. 키를 하나로 두는 이유는 sync가 지금처럼
// ZRANGE 1회로 끝나야 해서다(Upstash 명령 수). 접두사의 NUL은 Next가 태그를
// `encodeHeaderSafe`로 `\t\x20-\x7e` 밖 문자를 퍼센트 인코딩하므로
// (next/dist/server/lib/encode-header-safe.js) 실제 태그와 절대 충돌하지 않는다.
// 롤백 호환: 이 접두사를 모르는 옛 코드는 그 멤버를 "아무 엔트리에도 안 붙은 태그"로
// 보고 무시하고, 옛 코드가 쓴 평문 멤버는 새 코드가 stale로 읽는다(옛 코드는 전부
// 'max' 경로였으므로 의도와 일치).
//
// ### 미래 시점 expire는 근사한다
//
// Next는 `expired = now + durations.expire*1000`처럼 **미래** 만료도 기록한다. 이 스토어는
// 즉시 만료(`expire <= 0` 또는 durations 없음)만 expired로 기록하고, 양수 expire는
// stale로만 근사한다. 이 저장소의 모든 호출부는 'max'(1년)라 보존 기간(7d)을 넘어
// 관측 자체가 불가능하고, 짧은 inline 프로필을 쓰기 시작하면 이 근사를 재검토할 것.
// (그 경우에도 라우트 자체의 `expire`는 Next가 cacheControl로 따로 강제한다.)
//
// 정렬셋을 쓰는 이유: 전체 태그 맵을 매번 받아오지 않고 `score >= 마지막 sync` 조건으로
// **변경분만** 가져올 수 있다. 무효화가 없는 정상 상태에선 응답이 빈 배열이라 사실상 공짜다.
//
// ## 보장되는 것과 보장되지 않는 것
//
// 보장: 인스턴스 A의 revalidateTag는 최대 REFRESH_INTERVAL_MS + 1 요청 안에 인스턴스 B의
// 로컬 맵에 반영된다. 이후 B가 읽는 **기존** 캐시 엔트리는 stale(또는 expired)로 판정된다.
//
// 보장되지 않음 — **재생성 중 무효화 창(regenerate-in-flight window)**: A가 페이지를
// 렌더하는 도중(수 초) B가 그 태그를 무효화하면, A의 set()은 렌더 **완료** 시각을
// lastModified로 기록한다. 이 값이 무효화 시각보다 크므로 방금 저장된(이미 낡은) HTML이
// revalidate TTL(6~24h) 동안 fresh로 판정된다. 모든 인스턴스가 무효화를 **알고 있어도**
// 그렇다. 이는 단일 인스턴스에서도 동일하게 존재하던 선행 레이스이며 이 변경이 만든 것이
// 아니지만, 스케일아웃에서 더 자주 발생한다(야간 pre-warm이 B에서 돌고 A가 크롤러를
// 서빙하는 조합). 렌더 시작 시각을 알 수 없어 핸들러 계층에서 정확히 고칠 수 없다.
//
// ## 시계 가정
//
// score와 entry.lastModified는 **서로 다른 인스턴스의 벽시계**에서 나온다. 따라서 판정
// `maxRevalidatedAt > lastModified`의 정확성은 **인스턴스 시계가 NTP 동기화돼 있다**는
// 가정에 의존한다(AL2023 골든 AMI의 chrony/Amazon Time Sync). SYNC_OVERLAP_MS는 sync
// **창**만 넓힐 뿐 이 비교에는 영향을 주지 않는다 — 둘을 혼동하지 말 것.
//
// ## fail-open
//
// Upstash 미설정(빌드 타임 prerender — Dockerfile에 UPSTASH secret mount가 없다)이거나
// 네트워크 오류면 전부 no-op으로 떨어져 **기존 로컬 전용 동작과 동일**해진다.
// 캐시 read/write 경로는 어떤 경우에도 throw하지 않는다.

import {
    expireKey,
    isUpstashConfigured,
    serverTimeMs,
    zaddGreater,
    zrangeFromScore,
    zremBelowScore,
} from './upstashRest.mjs';

// 배포(GIT_SHA)로 네임스페이스하지 않는다 — 롤링 배포 중 신·구 인스턴스가 같은 태그 로그를
// 봐야 서로의 무효화를 인지한다. S3 엔트리는 GIT_SHA prefix로 갈리지만 태그는 공유가 맞다.
const TAG_LOG_KEY = 'siglens:isr:tags';

// 즉시 만료(expired) 무효화 멤버의 접두사. 위 "stale과 expired" 참고.
const EXPIRED_MEMBER_PREFIX = '\u0000expired:';

// 인스턴스 간 전파 지연 상한. sync는 read에서만 트리거되므로 트래픽이 없으면 비용도 0이다.
//
// 30초인 이유: 5초일 때 트래픽이 끊이지 않는 인스턴스 하나가 하루 ~17,000건의 ZRANGE를
// 냈다(86400/5). 운영은 인스턴스 1대(ASG desired 1)라 원격 sync가 실제로 전파하는
// 무효화는 거의 없다 — 이 인스턴스 자신의 무효화는 `markRevalidated`로 즉시 로컬에
// 반영되고(read-your-writes), 콜드 인스턴스의 첫 sync(부트스트랩)는 이 간격과 무관하게
// 보존 기간 전체를 읽는다. 30초면 하루 ~2,900건이고, 스케일아웃 시 타 인스턴스 무효화의
// 전파 지연이 최대 30초로 느는 것은 'max' SWR 의미론(어차피 한 번은 stale을 서빙)
// 안에 묻힌다.
//
// ⚠️ 즉시 만료(durations 없는 `revalidateTag` / `updateTag`) 무효화도 같은 경로로 전파되므로
// **다른 인스턴스에는 최대 ~30초 + 페이지 L1 TTL(pageMemStore, ≤60초)** 동안 반영되지 않는다
// (그 사이 그 인스턴스는 낡은 값을 fresh로 서빙할 수 있다). 1대 운영(ASG desired 1)에서는
// 무관하지만, 인스턴스를 2대 이상으로 늘릴 때 이 간격(과 L1 TTL)을 반드시 재검토할 것.
const REFRESH_INTERVAL_MS = 30_000;

// 연속 실패 시 재시도 간격(지수 백오프). 첫 재시도는 정상 주기를 기다리지 않고 1초 만에 —
// 부팅 직후의 일시적 blip이 정상 주기만큼의 맹점으로 굳지 않게 한다. 장애가 지속되면 60초까지
// 벌려, 실패한 sync가 짧은 주기로 7일치 전체 창을 재조회하는 낭비를 막는다.
const RETRY_BASE_MS = 1_000;
const RETRY_MAX_MS = 60_000;

// 부트스트랩에서 read 경로가 기다려주는 상한. 이 시간을 넘으면 sync는 백그라운드에서 계속
// 진행하되 요청은 그냥 통과시킨다(fail-open). 스케일아웃 직후 첫 요청 버스트 전체가
// 하나의 promise에 묶여 최대 2초(요청 타임아웃)를 대기하는 것을 막고, 동시에 어떤
// 이유로든 sync가 영원히 settle되지 않아도 read가 잠기지 않도록 구조적으로 보장한다.
const BOOTSTRAP_AWAIT_MS = 1_000;

// 태그 로그 보존 기간.
//
// 불변식: RETENTION_MS는 **태그가 달린** 캐시 엔트리의 최대 revalidate보다 커야 한다.
// 그보다 오래된 무효화 시각은 어떤 엔트리의 lastModified보다도 앞설 수 없어 판정에
// 영향을 주지 않기 때문이다. 현재 태그가 달리는 APP_PAGE의 최대 revalidate는 24h다.
// (og/twitter APP_ROUTE는 30d지만 순수 함수라 태그가 붙은 fetch가 없다 — 여기에 태그를
// 붙이는 변경이 생기면 이 상수를 재검토할 것.) 7d는 충분한 여유값.
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

// 태그 로그 키 자체의 만료. 쓰기마다 갱신되므로 정상 운영 중엔 만료되지 않고, 롤백으로
// 이 코드가 사라지면 고아 키가 스스로 정리된다.
const KEY_TTL_SECONDS = 30 * 24 * 60 * 60;

// sync 하한을 조금 앞당겨 쓰기 가시성 지연을 흡수한다. 겹쳐 읽어도 병합이 멱등(max)이라
// 무해하다. (위 "시계 가정" 참조 — 이 값은 판정 정확성과는 무관하다.)
const SYNC_OVERLAP_MS = 60_000;

const PRUNE_INTERVAL_MS = 60 * 60 * 1000;
const ERROR_LOG_INTERVAL_MS = 60_000;

// 이 이상 미래의 score를 병합하면 시계 어긋남으로 보고 경고한다(위 "시계 가정" 참조).
const CLOCK_SKEW_WARN_MS = 10_000;

// tag → 마지막 무효화 시각(stale 기준). 모든 무효화가 여기 찍힌다.
const revalidatedAt = new Map();
// tag → 마지막 **즉시 만료** 무효화 시각. durations 없는 무효화만 찍힌다.
const expiredAt = new Map();

// 이 시각(wall clock)까지의 원격 변경분을 병합했다고 간주한다. 0 = 아직 sync 성공 없음.
let syncedThrough = 0;
let lastSyncAttemptAt = 0;
let consecutiveFailures = 0;
let syncInFlight = null;
// 최초 1회(부트스트랩)만 read 경로에서 (상한을 두고) 기다린다.
let bootstrapped = false;
let lastPruneAt = 0;
// 스코프별 마지막 로그 시각. 단일 커서를 쓰면 주기적으로 도는 sync 실패가 창을 독점해
// **더 심각한** publish 실패(다른 인스턴스가 무효화를 영구히 놓침)가 묻힌다.
const lastErrorLoggedAt = new Map();

function logThrottled(scope, error) {
    const now = Date.now();
    if (now - (lastErrorLoggedAt.get(scope) ?? 0) < ERROR_LOG_INTERVAL_MS)
        return;
    lastErrorLoggedAt.set(scope, now);
    // fail-open이라 캐시 동작은 계속되지만, 전파가 끊긴 상태이므로 error로 남긴다.
    // 이 접두사는 infra/aws/07-alarms.sh의 메트릭 필터와 맞춰져 있다 — 변경 시 함께 수정.
    console.error(
        `[isr-cache] tag ${scope} failed`,
        error?.name,
        error?.message
    );
}

// 항상 max로 병합한다 — 원격에서 늦게 도착한 옛 타임스탬프가 최신 무효화를 되돌리면
// 이미 무효화된 엔트리가 fresh로 되살아난다.
function mergeMax(map, tag, timestamp) {
    if ((map.get(tag) ?? 0) < timestamp) map.set(tag, timestamp);
}

// expired는 stale을 함의한다 — 만료된 엔트리가 stale 판정에서만 fresh로 보이면 안 된다.
function mergeLocal(tag, timestamp, expired) {
    mergeMax(revalidatedAt, tag, timestamp);
    if (expired) mergeMax(expiredAt, tag, timestamp);
}

/**
 * 로컬 태그 맵에 무효화 시각을 기록한다(동기 — read-your-writes 보장).
 * 원격 전파는 `publishRevalidated`가 담당한다.
 *
 * @param {{ expired?: boolean }} [options] `expired: true`면 즉시 만료(블로킹 재생성)
 *   무효화로도 기록한다. 기본은 stale(SWR) 무효화다.
 */
export function markRevalidated(tag, now, { expired = false } = {}) {
    mergeLocal(tag, now, expired);
}

function maxOf(map, tags) {
    return tags.reduce((max, tag) => {
        const t = map.get(tag) ?? 0;
        return t > max ? t : max;
    }, 0);
}

/**
 * 엔트리 태그들의 최대 무효화(stale) 시각. **동기 + 로컬 전용** — 캐시 get의 hot path이므로
 * 절대 네트워크를 타지 않는다.
 */
export function maxRevalidatedAt(tags) {
    return maxOf(revalidatedAt, tags);
}

/** 엔트리 태그들의 최대 **즉시 만료** 무효화 시각. 동기 + 로컬 전용. */
export function maxExpiredAt(tags) {
    return maxOf(expiredAt, tags);
}

// 원격 멤버 → [tag, expired]. 접두사가 붙은 멤버는 즉시 만료 무효화다.
function parseMember(member) {
    return member.startsWith(EXPIRED_MEMBER_PREFIX)
        ? [member.slice(EXPIRED_MEMBER_PREFIX.length), true]
        : [member, false];
}

async function syncFromRemote() {
    const now = Date.now();
    const retentionFloor = now - RETENTION_MS;
    // 첫 sync는 보존 기간 전체를 읽어 콜드 인스턴스가 기존 무효화를 모두 학습하게 한다.
    // S3 캐시는 인스턴스 간 공유되므로, 신규 인스턴스가 태그 로그를 모르면 이미 무효화된
    // 엔트리를 fresh로 오판해 서빙한다.
    const floor =
        syncedThrough === 0
            ? retentionFloor
            : Math.max(syncedThrough - SYNC_OVERLAP_MS, retentionFloor);

    const { pairs, rawLength } = await zrangeFromScore(TAG_LOG_KEY, floor);

    // 응답에 원소는 있는데 해석된 쌍이 0이면 와이어 포맷이 바뀐 것이다(예: RESP3가
    // 협상되면 [[member, score], ...] 중첩 배열이 온다). 그대로 두면 기능이 "정상"으로
    // 보이면서 아무것도 전파하지 않는 무동작 상태가 된다 — 이 레포가 여러 번 겪은 실패다.
    if (rawLength > 0 && pairs.length === 0) {
        logThrottled(
            'sync',
            new Error(
                `zrange returned ${rawLength} elements but no parsable (member, score) pairs — wire format changed?`
            )
        );
    }

    for (const [member, score] of pairs) {
        const [tag, expired] = parseMember(member);
        if (tag.length === 0) continue;
        // 병합하는 score가 로컬 시각보다 크게 앞서면 쓴 인스턴스의 시계가 앞선 것이다.
        // 이 상태에서는 이 인스턴스가 재생성해 저장하는 엔트리마다 lastModified가 곧바로
        // 무효화 시각보다 작아져 **매 요청 재생성 루프**에 빠진다. 조용히 지나가면
        // CPU·S3 쓰기만 늘고 원인을 찾을 수 없으므로 신호를 남긴다.
        if (score > now + CLOCK_SKEW_WARN_MS) {
            logThrottled(
                'sync',
                new Error(
                    `tag "${tag}" has a future score (+${score - now}ms) — instance clock skew?`
                )
            );
        }
        mergeLocal(tag, score, expired);
    }

    // 성공했을 때만 워터마크를 전진시킨다 — 실패 후 다음 sync가 보존 기간 전체를
    // 다시 읽어 놓친 무효화를 복구할 수 있어야 한다.
    syncedThrough = now;
    pruneLocal(retentionFloor);
}

// 보존 기간이 지난 로컬 엔트리를 제거해 맵이 무한정 커지지 않게 한다.
// 실제 상한은 `revalidateTag`에 실제로 전달되는 태그의 종류 수다(현재 `news:{SYMBOL}`,
// market-news 5종, economy·indicator 고정 태그, 그리고 SEO pre-warm의
// `seo-snapshot:{SYMBOL}`). 캐시 **쓰기** 태그(`symbol:{TICKER}` 등)는 revalidateTag로
// 전달되지 않으므로 여기 들어오지 않는다.
function pruneLocal(floor) {
    for (const map of [revalidatedAt, expiredAt]) {
        for (const [tag, timestamp] of map) {
            if (timestamp < floor) map.delete(tag);
        }
    }
}

/** 프로세스를 살려두지 않는 지연 타이머. */
function delay(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms).unref();
    });
}

function nextAttemptGapMs() {
    if (consecutiveFailures === 0) return REFRESH_INTERVAL_MS;
    return Math.min(
        RETRY_BASE_MS * 2 ** (consecutiveFailures - 1),
        RETRY_MAX_MS
    );
}

/**
 * 다른 인스턴스의 무효화를 로컬 맵에 반영한다.
 *
 * Promise를 반환하는 경우는 **부트스트랩(최초 1회)뿐**이며, 그마저도
 * BOOTSTRAP_AWAIT_MS 상한이 걸려 있다. 이후에는 백그라운드로 돌고 `undefined`를
 * 반환해 read 경로에 지연을 추가하지 않는다.
 */
export function ensureTagsFresh() {
    if (!isUpstashConfigured()) return undefined;

    if (syncInFlight) {
        return bootstrapped
            ? undefined
            : Promise.race([syncInFlight, delay(BOOTSTRAP_AWAIT_MS)]);
    }

    const now = Date.now();
    if (bootstrapped && now - lastSyncAttemptAt < nextAttemptGapMs())
        return undefined;
    lastSyncAttemptAt = now;

    syncInFlight = syncFromRemote()
        .then(() => {
            consecutiveFailures = 0;
        })
        .catch(error => {
            consecutiveFailures++;
            logThrottled('sync', error);
        })
        .finally(() => {
            syncInFlight = null;
            bootstrapped = true;
        });

    return bootstrapped
        ? undefined
        : Promise.race([syncInFlight, delay(BOOTSTRAP_AWAIT_MS)]);
}

/**
 * 무효화를 원격 태그 로그에 durable하게 기록한다. revalidateTag 경로에서 await된다.
 * 실패해도 throw하지 않는다 — 로컬 맵에는 이미 기록됐으므로 이 인스턴스는 정상 동작하고,
 * 다른 인스턴스만 해당 무효화를 놓친다(기존 로컬 전용 동작과 같은 수준으로 degrade).
 *
 * @param {{ expired?: boolean }} [options] `expired: true`면 stale 멤버와 함께 만료 멤버도
 *   기록한다(위 "stale과 expired" 참고).
 */
export async function publishRevalidated(tags, now, { expired = false } = {}) {
    if (!isUpstashConfigured()) return;

    const list = Array.isArray(tags) ? tags : [tags];
    const entries = list
        .filter(tag => typeof tag === 'string' && tag.length > 0)
        .flatMap(tag =>
            expired
                ? [
                      [now, tag],
                      [now, `${EXPIRED_MEMBER_PREFIX}${tag}`],
                  ]
                : [[now, tag]]
        );
    if (entries.length === 0) return;

    try {
        await zaddGreater(TAG_LOG_KEY, entries);
    } catch (firstError) {
        // ZADD GT는 멱등이라 전체 재시도가 안전하다. 무효화를 한 번의 일시적 오류로
        // 영구히 잃는 것보다 한 번 더 시도하는 편이 낫다.
        try {
            await zaddGreater(TAG_LOG_KEY, entries);
        } catch {
            logThrottled('publish', firstError);
            return;
        }
    }

    // 아래는 순수 housekeeping이라 요청 경로를 붙잡지 않는다(await하지 않음).
    if (now - lastPruneAt < PRUNE_INTERVAL_MS) return;
    lastPruneAt = now;
    void houseKeep();
}

async function houseKeep() {
    try {
        // 정리 하한은 **Redis 서버 시각**에서 얻는다. 로컬 시계가 크게 앞선 인스턴스
        // 하나가 공유 태그 로그 전체를 지워버리는 것을 막는다.
        const serverNow = await serverTimeMs();
        await zremBelowScore(TAG_LOG_KEY, serverNow - RETENTION_MS);
        await expireKey(TAG_LOG_KEY, KEY_TTL_SECONDS);
    } catch (error) {
        logThrottled('prune', error);
    }
}

/** 테스트 전용 — 로컬 맵과 sync 상태를 초기화한다. */
export function _resetForTest() {
    revalidatedAt.clear();
    expiredAt.clear();
    syncedThrough = 0;
    lastSyncAttemptAt = 0;
    consecutiveFailures = 0;
    syncInFlight = null;
    bootstrapped = false;
    lastPruneAt = 0;
    lastErrorLoggedAt.clear();
}
