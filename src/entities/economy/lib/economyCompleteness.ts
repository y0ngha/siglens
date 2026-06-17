import type { EconomySnapshot } from '@y0ngha/siglens-core';

/**
 * 전 축(지표 모두 null + treasury null + calendar 비어있음)이면 빈 스냅샷이다.
 *
 * /economy 페이지의 degrade/noindex 판정 단일 소스 — `EconomyDegraded`
 * 렌더와 `generateMetadata`의 `robots: { index: false }`가 같은 결과를 본다.
 */
export function isEmptyEconomySnapshot(snapshot: EconomySnapshot): boolean {
    const noIndicators = snapshot.indicators.every(i => i.latest === null);
    return (
        noIndicators &&
        snapshot.treasury === null &&
        snapshot.calendar.length === 0
    );
}
