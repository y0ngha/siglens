import type { EconomySnapshot } from '@y0ngha/siglens-core';

/**
 * 전 축(지표 모두 null + treasury null + calendar 비어있음)이면 빈 스냅샷이다.
 *
 * /economy 페이지의 degrade/noindex 판정 단일 소스 — `EconomyDegraded`
 * 렌더와 `generateMetadata`의 `robots: { index: false }`가 같은 결과를 본다.
 *
 * 의도적 asymmetry:
 * - 렌더는 "완전히 비어있을 때만" degrade한다(최소한의 데이터라도 있으면 표시).
 * - 캐시 여부는 `shouldCacheEconomySnapshot`이 별도 quorum 기준으로 결정한다.
 * 두 함수를 분리하는 이유는 아래 `shouldCacheEconomySnapshot` JSDoc 참조.
 */
export function isEmptyEconomySnapshot(snapshot: EconomySnapshot): boolean {
    const noIndicators = snapshot.indicators.every(i => i.latest === null);
    return (
        noIndicators &&
        snapshot.treasury === null &&
        snapshot.calendar.length === 0
    );
}

/**
 * 스냅샷을 24h 캐시에 고정해도 안전한지 판단하는 quorum 기반 predicate.
 *
 * ## `isEmptyEconomySnapshot`과의 asymmetry
 *
 * - **렌더 기준(`isEmptyEconomySnapshot`)**: 완전히 빈 스냅샷일 때만 `EconomyDegraded`를
 *   표시한다. 최소한의 데이터(treasury만 있어도)라도 있으면 페이지를 렌더한다(noindex만 유지).
 *
 * - **캐시 기준(`shouldCacheEconomySnapshot`)**: 더 엄격하다. 9개 지표 중 과반(≥ 6개)이
 *   latest 값을 갖고, treasury·calendar 중 하나 이상이 있어야 캐시를 허용한다.
 *   이 조건을 통과하지 못하면 24h TTL 동안 부분 실패 결과가 고정되는 사고를 방지한다.
 *
 * 예시: 8개 지표 fetch 실패 → 1개만 populated. `isEmptyEconomySnapshot = false`(렌더는 함)
 * → `shouldCacheEconomySnapshot = false`(캐시는 하지 않음, 다음 요청에서 재시도).
 *
 * @param snapshot - 조립 완료된 EconomySnapshot.
 * @returns true이면 캐시에 저장해도 안전. false이면 getOrSetCache의 shouldCache 가드가 차단.
 */
export function shouldCacheEconomySnapshot(snapshot: EconomySnapshot): boolean {
    const populatedCount = snapshot.indicators.filter(
        i => i.latest !== null
    ).length;
    const hasTreasuryOrCalendar =
        snapshot.treasury !== null || snapshot.calendar.length > 0;
    return populatedCount >= MIN_INDICATORS_FOR_CACHE && hasTreasuryOrCalendar;
}

/**
 * 캐시 허용에 필요한 최소 populated 지표 수 — 전체 9개의 2/3 = 6개.
 * 지표 레지스트리(ECONOMY_INDICATORS)가 9종이고, 2/3 quorum이면 단일 카테고리
 * 전멸(예: labor 3종 전부 실패) 시에도 캐시를 차단할 수 있다.
 */
export const MIN_INDICATORS_FOR_CACHE = 6;
