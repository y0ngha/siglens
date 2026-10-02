import 'server-only';
import { unstable_cache } from 'next/cache';
import { isFmpUnavailableAtBuild } from '@/shared/api/offlineBuild';

/** FMP 실패로 degrade된 빌드타임 prerender의 revalidate(초). */
export const BUILD_FMP_DEGRADED_REVALIDATE_SECONDS = 60;

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
    ['build-fmp-degraded-revalidate'],
    { revalidate: BUILD_FMP_DEGRADED_REVALIDATE_SECONDS }
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
