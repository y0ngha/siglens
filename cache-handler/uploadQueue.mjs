// S3 업로드를 응답 경로에서 떼어내는 백그라운드 큐.
//
// ## 왜
//
// 캐시 miss의 응답은 S3 PUT을 기다리고 있었다. ResponseCache는 재생성 결과를
// `await incrementalCache.set(...)` 한 뒤에야 엔트리를 돌려주고
// (next/dist/server/response-cache/index.js:294-300), IncrementalCache.set은 핸들러 set을
// await한다(next/dist/server/lib/incremental-cache/index.js:540). 즉 miss 응답 하나가
// gzip + v8.serialize + PutObject(수백 KB, 수십~수백 ms) 뒤에 줄을 섰다.
//
// ## 보장
//
// - **같은 인스턴스의 read-your-writes**: 업로드가 끝날 때까지 엔트리 사본을 `pending`에
//   둔다. `index.mjs` get()이 메모리 계층 다음, S3 이전에 이걸 본다 — 큰 FETCH(메모리 게이트
//   초과)나 페이지 메모리 계층이 거부한 큰 페이지도 업로드 중에 miss로 보이지 않는다.
// - **같은 키의 쓰기 순서**: 키별로 체인을 걸어 앞선 업로드가 끝난 뒤 다음을 올린다.
//   병렬로 PUT하면 늦게 시작한 새 값을 먼저 시작한 옛 값이 덮을 수 있다. 대기 중에 더 새
//   값이 들어오면 중간 값은 건너뛴다(최신만 올린다).
// - **종료 시 drain**: SIGTERM 핸들러(src/instrumentation.node.ts)가 전역 심볼로
//   `drainUploads`를 찾아 기다린다. 핸들러는 Next가 절대 경로로 동적 import하고
//   instrumentation은 번들 안이라 모듈을 직접 공유할 수 없어 `Symbol.for`로 잇는다
//   (Next 자신도 `Symbol.for('@next/cache-handlers')`로 같은 일을 한다).
// - **배압**: 진행 중 업로드가 `MAX_IN_FLIGHT`를 넘으면 그 set은 예전처럼 업로드를
//   기다린다. S3가 느려질 때 사본이 무한정 쌓여 힙을 먹는 것을 막는다.
//
// 업로드 실패는 `s3Store.setEntry`가 이미 삼키고 로그를 남긴다 — 결과는 "다음 인스턴스/재시작
// 후 한 번 더 재생성"이고, 예전에도 같은 실패는 응답에 영향을 주지 않았다.

import { setEntry as s3Set } from './s3Store.mjs';
import { readPositiveBound } from './boundedLru.mjs';

// 전역 레지스트리 키. 값은 drain 함수들의 **Set**이다 — 핸들러 모듈이 둘 이상 로드돼도
// (다른 경로/번들 사본) 서로를 덮어쓰지 않고, instrumentation이 전부 drain한다.
export const DRAIN_UPLOADS_SYMBOL = Symbol.for('siglens.isrCache.drainUploads');

const MAX_IN_FLIGHT = readPositiveBound('ISR_CACHE_MAX_INFLIGHT_UPLOADS', 64);

/** slot → 아직 S3에 오르지 않은 최신 엔트리. */
const pending = new Map();
/** slot → 그 키의 마지막 업로드 promise(체인 꼬리). */
const tails = new Map();
/** drain용 — 진행 중인 모든 업로드. */
const inFlight = new Set();

// S3 키와 같은 축으로 가른다 — 같은 문자열 키라도 FETCH와 페이지는 다른 객체다
// (s3Store.mjs `s3Key`의 fetch/ · pages/ 분기).
function slotOf(key, kind) {
    return `${kind === 'FETCH' ? 'fetch' : 'pages'}:${key}`;
}

/** 업로드 대기/진행 중인 엔트리 사본. 없으면 null. */
export function pendingEntry(key, kind) {
    return pending.get(slotOf(key, kind)) ?? null;
}

/**
 * 엔트리를 백그라운드로 S3에 올린다. 보통 즉시 resolve되고, 배압이 걸렸을 때만 이번
 * 업로드가 끝날 때까지 기다린다. 절대 reject하지 않는다.
 */
export async function scheduleUpload(key, kind, entry) {
    const slot = slotOf(key, kind);
    pending.set(slot, entry);

    const previous = tails.get(slot) ?? Promise.resolve();
    const upload = previous
        .then(() => {
            // 기다리는 사이 더 새 값이 들어왔으면 그쪽 체인 링크가 올린다.
            if (pending.get(slot) !== entry) return undefined;
            return s3Set(key, kind, entry);
        })
        .catch(error => {
            // s3Set은 자체적으로 삼키지만, 체인이 reject로 끊기면 같은 키의 이후 업로드가
            // 전부 건너뛰어지므로 여기서 한 번 더 막는다.
            console.error(
                '[isr-cache] background upload failed',
                key,
                error?.name,
                error?.message
            );
        })
        .finally(() => {
            inFlight.delete(upload);
            if (tails.get(slot) === upload) tails.delete(slot);
            if (pending.get(slot) === entry) pending.delete(slot);
        });

    tails.set(slot, upload);
    inFlight.add(upload);
    if (inFlight.size > MAX_IN_FLIGHT) await upload;
}

/** 프로세스를 살려두지 않는 지연 타이머. */
function delay(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms).unref();
    });
}

/**
 * 진행 중인 업로드가 끝날 때까지 최대 `deadlineMs` 기다린다. drain 중에 새로 들어온
 * 업로드도 마감 안에서 함께 기다린다. 남은 개수를 돌려준다(0이면 전부 완료).
 */
export async function drainUploads(deadlineMs) {
    const deadlineAt = Date.now() + deadlineMs;
    while (inFlight.size > 0) {
        const remaining = deadlineAt - Date.now();
        if (remaining <= 0) break;
        // allSettled는 호출 시점에 Set을 순회해 스냅샷을 잡는다 — 그 뒤 들어온 업로드는
        // 다음 루프가 기다린다.
        await Promise.race([Promise.allSettled(inFlight), delay(remaining)]);
    }
    return inFlight.size;
}

/** 테스트/진단용. */
export function inFlightCount() {
    return inFlight.size;
}

/** 테스트 격리용. 진행 중 promise는 그대로 두고 추적만 끊는다. */
export function __resetForTests() {
    pending.clear();
    tails.clear();
    inFlight.clear();
}

/** 전역 drain 레지스트리에 이 모듈의 drain을 추가한다(멱등). 등록 사실을 한 줄 남긴다. */
export function registerDrain(registry = globalThis) {
    const drains =
        registry[DRAIN_UPLOADS_SYMBOL] instanceof Set
            ? registry[DRAIN_UPLOADS_SYMBOL]
            : new Set();
    registry[DRAIN_UPLOADS_SYMBOL] = drains;
    if (drains.has(drainUploads)) return;
    drains.add(drainUploads);
    console.log(
        `[isr-cache] background upload drain registered (registry size ${drains.size})`
    );
}

registerDrain();
