// Next 16.3.6 IncrementalCache의 판정 규칙에 핸들러가 맞춰야 하는 지점을 한곳에 모은다.
//
// 단수 `cacheHandler`의 get()은 `{ lastModified, value }`만 돌려줄 수 있고, "stale인가"는
// Next의 IncrementalCache.get이 lastModified와 라우트의 cacheControl로 **스스로** 계산한다
// (핸들러에 isStale을 직접 돌려줄 통로가 없다). 그래서 태그 무효화를 SWR(stale 서빙 +
// 백그라운드 재생성)로 표현하려면 "Next가 stale로 계산할 lastModified"를 돌려줘야 하고,
// 그 계산은 아래 Next 소스와 정확히 일치해야 한다. Next를 올릴 때는 이 파일의 인용을 다시
// 확인할 것 — 어긋나면 무효화된 엔트리가 조용히 fresh로 서빙된다.

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// 판정 여유. 핸들러가 계산한 직후 Next가 자기 `now`(더 늦은 시각)로 다시 비교하므로
// "stale 경계"는 늦어질수록 더 확실해지고, "expire 경계"는 그 간격만큼 가까워진다.
// 1초는 그 간격(동기 코드 몇 줄)보다 넉넉하다.
const STALE_MARGIN_MS = 1_000;

/**
 * next/dist/server/lib/to-route.js:33-35 그대로. IncrementalCache는 핸들러에 넘긴 것과
 * 같은 키로 `cacheControls.get(toRoute(cacheKey))`(incremental-cache/index.js:432)와
 * `cacheControls.set(toRoute(pathname), …)`(index.js:537-539)를 부른다.
 */
export function toRoute(pathname) {
    return pathname.replace(/(?:\/index)?\/?$/, '') || '/';
}

let sharedCacheControls;

/**
 * Next의 라우트별 cacheControl 공유 맵(`SharedCacheControls`)에 접근한다. 실패하면 null.
 *
 * 같은 모듈 인스턴스여야 의미가 있다. 근거:
 *   - `SharedCacheControls.cacheControls`는 **static** Map이다
 *     (next/dist/server/lib/incremental-cache/shared-cache-controls.external.js:12-15).
 *   - `.external.js` 접미사 파일은 Next가 번들에서 일부러 빼 두는 파일이다
 *     (next/dist/build/handle-externals.js:41, 276). 컴파일된 런타임
 *     (`next/dist/compiled/next-server/app-page{,-turbo}.runtime.prod.js` 등)은 이 파일을
 *     `require("next/dist/server/lib/incremental-cache/shared-cache-controls.external.js")`
 *     bare specifier로 불러 프로세스 안에서 하나의 인스턴스를 공유한다.
 *   - 이 핸들러는 standalone 이미지에서 `/app/cache-handler/`에 있고(Dockerfile COPY)
 *     같은 bare specifier가 `/app/node_modules/next/...`로 풀린다 — Node require 캐시가
 *     실경로 키라 같은 모듈 객체를 받는다.
 * 매니페스트 없이 생성해 `get`이 정적 맵만 보게 한다(매니페스트 폴백은 Next 쪽 인스턴스가 한다).
 */
function getSharedCacheControls() {
    if (sharedCacheControls !== undefined) return sharedCacheControls;
    try {
        const {
            SharedCacheControls,
        } = require('next/dist/server/lib/incremental-cache/shared-cache-controls.external.js');
        sharedCacheControls = new SharedCacheControls({
            routes: {},
            dynamicRoutes: {},
        });
    } catch (error) {
        // 프로덕션에서는 일어나면 안 된다 — standalone 이미지에 next가 항상 있다. 일어났다면
        // 재시작 직후 STALE + Cache-Control 누락(감사 F5)이 돌아오므로 error로 한 번 크게 남긴다.
        // 시드는 건너뛰고 아래 stale 판정은 엔트리에 영속한 값으로 계속 동작한다.
        // 같은 모듈 인스턴스인지와 판정 계약은 __tests__/incrementalCache.contract.test.mjs가
        // 실제 Next로 확인한다(일반 vitest `node` 프로젝트에 포함 — Next를 올리면 CI에서 깨진다).
        console.error(
            '[isr-cache] SharedCacheControls unavailable — route cacheControl reseed DISABLED (restart STALE regression)',
            error?.message
        );
        sharedCacheControls = null;
    }
    return sharedCacheControls;
}

function isCacheControl(value) {
    return (
        value !== null &&
        typeof value === 'object' &&
        (typeof value.revalidate === 'number' || value.revalidate === false)
    );
}

/**
 * 재시작 후 Next 메모리에서 사라진 라우트 cacheControl을 S3에 영속한 값으로 되살린다.
 *
 * Next는 라우트별 revalidate/expire를 **메모리에만** 둔다 — set 때
 * `this.cacheControls.set(toRoute(pathname), ctx.cacheControl)`(index.js:537-539).
 * 프리렌더 매니페스트에 없는 on-demand ISR 라우트(`/[symbol]` 계열)는 재시작 직후 이 값이
 * 없어서, IncrementalCache.get이 cacheControl `undefined` + 기본 revalidate 1초로 판정한다
 * (index.js:157-160): 첫 히트가 STALE이 되고 응답에 Cache-Control이 빠진다(app-page
 * 템플릿이 `cacheEntry.cacheControl`로 헤더를 만든다 — build/templates/app-page-runtime.js
 * :1091-1106). 핸들러 get()은 IncrementalCache가 cacheControls를 읽기 **전에** 불리므로
 * (index.js:359 → 432) 여기서 채우면 같은 요청부터 올바른 판정·헤더가 나간다.
 *
 * 이미 값이 있으면 건드리지 않는다 — 이 프로세스가 더 최근에 쓴 값이 우선이다.
 * 같은 빌드(S3 prefix가 GIT_SHA)에서 같은 라우트가 쓴 값이라 매니페스트 값을 덮어도
 * "이 프로세스가 그 라우트를 한 번 재생성한 상태"와 같다.
 */
export function seedCacheControl(cacheKey, cacheControl) {
    if (!isCacheControl(cacheControl)) return;
    const shared = getSharedCacheControls();
    if (!shared) return;
    const route = toRoute(cacheKey);
    if (shared.get(route) === undefined) shared.set(route, cacheControl);
}

/**
 * 태그 stale(SWR) 무효화된 엔트리를 Next가 **stale이지만 아직 만료 전**으로 판정하게 할
 * lastModified. 표현할 수 없으면 null(호출부가 miss로 돌려 블로킹 재생성 — 예전 동작).
 *
 * FETCH (incremental-cache/index.js:406-408):
 *     revalidate = ctx.revalidate || cacheData.value.revalidate
 *     isStale = (now - lastModified) / 1000 > revalidate
 *   unstable_cache는 revalidate:false를 1년으로 저장하고(unstable-cache.js:28), fetch는
 *   false를 INFINITE_CACHE로 정규화하므로(patch-fetch.js:56-59) 실사용 값은 항상 유한 숫자다.
 *   isStale이면 요청 렌더는 stale 값을 쓰고 백그라운드로 갱신하며(patch-fetch.js:804-818,
 *   unstable-cache.js:183-214), ISR 재생성(isStaticGeneration) 중에는 포그라운드로
 *   새로 받아 재생성된 페이지에 반영한다.
 *
 * APP_PAGE / APP_ROUTE / PAGES (index.js:432-468):
 *     revalidateAfter = cacheControl.revalidate * 1000 + lastModified   (없으면 1초)
 *     expireAfter     = cacheControl.expire * 1000 + lastModified
 *     expireAfter < now → isStale = -1 (블로킹), revalidateAfter < now → isStale = true (SWR)
 *   ResponseCache는 isStale === true면 이전 엔트리로 먼저 응답하고 재생성한다
 *   (response-cache/index.js:210-216). 그래서 `now - revalidate - 여유`를 돌려주되,
 *   그 값이 expire 경계를 넘으면 null이다. revalidate:false면 시간으로 stale을 표현할 수 없다.
 *   cacheControl은 Next 공유 맵(시드 후)을 먼저 보고, 없으면 엔트리에 영속한 값을 쓴다.
 */
export function staleLastModified({ cacheKey, kind, entry, ctx, now }) {
    if (kind === 'FETCH') {
        const revalidate = ctx?.revalidate || entry.value?.revalidate;
        return typeof revalidate === 'number' &&
            Number.isFinite(revalidate) &&
            revalidate > 0
            ? Math.min(
                  entry.lastModified,
                  now - revalidate * 1000 - STALE_MARGIN_MS
              )
            : null;
    }

    const cacheControl =
        getSharedCacheControls()?.get(toRoute(cacheKey)) ?? entry.cacheControl;
    if (!isCacheControl(cacheControl)) return null;
    const { revalidate, expire } = cacheControl;
    if (typeof revalidate !== 'number') return null;
    // 실제 lastModified보다 새로워지지 않게 min — 이미 시간상 stale/만료인 엔트리를 태그
    // stale 처리가 "덜 낡게" 만들면 Next의 시간 기반 expire(블로킹)가 무력해진다.
    const lastModified = Math.min(
        entry.lastModified,
        now - revalidate * 1000 - STALE_MARGIN_MS
    );
    if (
        typeof expire === 'number' &&
        lastModified + expire * 1000 <= now + STALE_MARGIN_MS
    )
        return null; // 블로킹 재생성 — Next도 isStale=-1로 같은 결과를 낸다
    return lastModified;
}
