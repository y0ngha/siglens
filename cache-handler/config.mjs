import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// S3 키는 두 수명으로 갈린다(s3Store.mjs `s3Key`).
//
//   - `pages/` (APP_PAGE · APP_ROUTE · PAGES) — **빌드 스코프** `buildId`(= GIT_SHA, 값은
//     릴리스 버전 IMAGE_TAG). HTML·RSC 페이로드는 그 빌드의 청크 해시·클라이언트 참조
//     매니페스트를 박고 있어 다른 빌드가 읽으면 깨진 셸이 나간다. OG/twitter 이미지(APP_ROUTE)도
//     렌더 코드의 산출물이라 같은 쪽에 둔다. 배포마다 prefix가 갈려 옛 엔트리는 자동 무효화된다.
//   - `fetch/` (FETCH = 전역 `fetch()` 데이터 캐시 + `unstable_cache`) — **데이터 스코프**
//     `dataScope`. 빌드 산출물이 아니라 외부 응답·조회 결과라 배포를 넘어 공유한다
//     (2026-10 감사: 배포가 하루 3~4회라 데이터 캐시가 정상 상태에 닿지 못했고, 658KB
//     `bars-static-v2` 같은 큰 엔트리가 배포마다 다시 계산·PUT됐다). 태그 무효화 로그는
//     원래 배포와 무관하게 공유된다(tagStore.mjs) — 데이터 엔트리도 이제 같은 수명이다.
//
// 롤링 배포 중에는 신·구 빌드가 같은 `fetch/` 엔트리를 동시에 읽고 쓴다. 그래서 값의 모양이
// 바뀌면 반드시 키가 갈려야 한다:
//
// ## DATA_CACHE_VERSION 올리는 규칙
//
// 기여자용 요약은 docs/conventions/CONVENTIONS.md "Server Data Cache Rules"에 있다 — 바꾸면 함께.
//
// 올린다(정수 +1) — 캐시된 값 전체의 형식이 바뀔 때:
//   - 엔트리 직렬화 형식(serialize.mjs)이나 핸들러가 감싸는 모양(index.mjs의
//     `{ value, lastModified, tags }`)을 바꿀 때
//   - 여러 `unstable_cache` 호출부가 공유하는 헬퍼의 반환 모양을 한꺼번에 바꿔, 호출부마다
//     키 버전을 올리기 어려울 때
//   - 데이터 캐시가 오염돼 통째로 버려야 할 때(비상). 올리고 배포하면 새 prefix에서 시작한다.
//
// 올리지 않는다 — 한 엔트리의 모양만 바뀔 때는 그 호출부의 키 버전을 올린다
// (`['bars-static-v2', …]` → `v3`처럼 keyParts의 접미사). 영향 범위가 그 엔트리로 한정되고
// 나머지 데이터 캐시는 따뜻하게 남는다. `fetch()` 엔트리는 URL·헤더·본문이 키라 요청이 바뀌면
// 저절로 갈린다.
//
// 배포마다 새로 받아야 하는 데이터(예: 약관 — "발효 직후 배포로 즉시 재생성" 절차)는 keyParts에
// 빌드 식별자를 넣어 빌드 스코프로 둔다(`src/shared/config/deployBuild.ts`).
//
// Next 버전은 prefix에 자동으로 들어간다 — FETCH 값의 모양(`CachedFetchValue`)은 Next가
// 정하고, `unstable_cache` 키 역시 Next가 콜백 소스로 만든다(next/dist/server/web/
// spec-extension/unstable-cache.js `fixedKey`). Next를 올리면 손으로 버전을 올리지 않아도
// 새 prefix에서 시작한다.
//
// 옛 prefix는 12-isr-cache.sh의 7일 lifecycle이 지운다(객체 생성 시각 기준).
export const DATA_CACHE_VERSION = 1;

// standalone 이미지에서 `/app/cache-handler/`는 `/app/node_modules/next`로 풀린다
// (nextInternals.mjs와 같은 해석). 못 찾으면 'unknown'으로 두고 동작은 계속한다 — 그 경우
// Next를 올려도 prefix가 갈리지 않으므로 DATA_CACHE_VERSION을 손으로 올려야 한다.
function resolveNextVersion() {
    try {
        return require('next/package.json').version;
    } catch (e) {
        console.warn('[isr-cache] next version unresolved', e?.message);
        return 'unknown';
    }
}

export function dataScopeFor(version, nextVersion) {
    return `data-v${version}-next${nextVersion}`;
}

export const config = {
    bucket: process.env.ISR_CACHE_BUCKET,
    region: process.env.AWS_REGION || 'ap-northeast-2',
    keyPrefix: 'siglens-isr',
    buildId: process.env.GIT_SHA || 'dev',
    dataScope: dataScopeFor(DATA_CACHE_VERSION, resolveNextVersion()),
    disabled: process.env.ISR_CACHE_DISABLED === 'true',
    // `next build`(prerender) 중에는 S3를 건드리지 않는다. 빌드는 EC2 instance
    // role이 없는 도커 빌더에서 돌아 모든 GET/PUT이 CredentialsProviderError로
    // 실패하고(fail-open이라 빌드는 통과) 배포 로그를 수십 줄 채우면서 SDK 재시도
    // 대기만 더한다. 빌드 산출물은 Next가 직접 `.next`에 쓰므로 잃는 것이 없다.
    // Next가 빌드 시작 시 설정한다(next/dist/build/index.js: NEXT_PHASE=phase-production-build).
    // 같은 판정이 src/shared/api/offlineBuild.ts `isBuildPhase()`에 있다 — 이 파일은
    // 번들 밖(.mjs)이라 공유하지 못한다. 바꾸면 두 곳을 함께 바꾼다.
    buildPhase: process.env.NEXT_PHASE === 'phase-production-build',
};
