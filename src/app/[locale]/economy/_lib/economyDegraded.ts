import type { EconomySnapshot } from '@y0ngha/siglens-core';
import { isEmptyEconomySnapshot } from '@/entities/economy/lib/economyCompleteness';

/**
 * `/economy`가 그릴 데이터를 가졌는가 — `generateMetadata`(noindex)와 `EconomyContent`
 * (`EconomyDegraded` 분기)가 함께 쓰는 단일 술어. 로더 실패(`null`)와 전 축이 빈 스냅샷은
 * 둘 다 데이터 없음이다. degrade 술어를 그대로 두지 않고 긍정형 type guard로 둔 이유는,
 * 본문이 거짓 분기에서 스냅샷을 `EconomySnapshot`으로 좁혀 써야 하기 때문이다.
 */
export function hasEconomyData(
    snapshot: EconomySnapshot | null
): snapshot is EconomySnapshot {
    return snapshot !== null && !isEmptyEconomySnapshot(snapshot);
}

/**
 * `/economy/kr`이 degrade(noindex·구조화데이터 생략)인가 — 지표 카드도 캘린더도 없을 때만.
 * 지표만 빈 상태(인제스션 직후 첫 크롤의 흔한 모습)는 캘린더가 있어 색인할 만한 렌더다.
 * `generateMetadata`와 `KrEconomyContent`가 함께 쓰는 단일 술어. 개수만 보므로 원소 타입을 묻지 않는다.
 */
export function isKrEconomyDegraded(
    cards: readonly unknown[],
    calendarEvents: readonly unknown[]
): boolean {
    return cards.length === 0 && calendarEvents.length === 0;
}
