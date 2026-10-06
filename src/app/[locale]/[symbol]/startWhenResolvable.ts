import type { ResilientAssetInfo } from '@/entities/ticker/lib/getAssetInfoResilient';

/**
 * 탭 본문 데이터(재무 6종·의회 거래 등 FMP 묶음)를 **심볼이 실재한다고 확인된 뒤에만**,
 * 그러나 나머지 게이트(profile·스냅샷)를 기다리지 않고 시작한다.
 *
 * 왜: 예전에는 게이트(profile·asset·snapshots) → 본문 데이터가 직렬이라 cold render가 FMP
 * 왕복 두 단을 탔다(2026-10 서버 성능 감사 L2). 그렇다고 탭 진입 즉시 시작하면 존재하지 않는
 * 심볼(봇이 긁는 임의 티커)마다 FMP 묶음을 헛되이 쏜다. 그 중간이 여기다 — 자산 해석은 캐시된
 * 경로(`getAssetInfoResilient` → `getAssetInfoStatic`, 레이아웃이 이미 읽은 엔트리)라 거의 즉시
 * 끝나고, 그 결과가 non-null일 때만 `load`를 시작해 profile·스냅샷 읽기와 겹친다.
 *
 * - 자산 정보가 `null`(실재하지 않음)이거나 `degraded`(인프라 실패 fallback — 실재 여부를 모름)이면
 *   시작하지 않고 `null`을 돌려준다. 호출부는 게이트를 통과한 뒤
 *   필요하면 `load()`를 직접 부른다(예전과 같은 직렬 경로).
 * - 반환 프라미스에는 처리 표시를 달아 둔다. 게이트가 `notFound()`로 끝나 아무도 await하지
 *   않을 때 `load`가 reject해도 unhandledRejection이 되지 않는다. await하는 쪽은 같은 rejection을
 *   그대로 받는다.
 *
 * @param asset 페이지가 게이트에도 쓰는 같은 `getAssetInfoResilient(upper)` 프라미스.
 */
export function startWhenResolvable<T>(
    asset: Promise<ResilientAssetInfo>,
    load: () => Promise<T>
): Promise<T | null> {
    const started = asset.then(({ assetInfo, degraded }) =>
        assetInfo === null || degraded ? null : load()
    );
    started.catch(() => {});
    return started;
}
