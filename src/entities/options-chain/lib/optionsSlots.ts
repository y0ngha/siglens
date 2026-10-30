import {
    mapExpirationsToSlots,
    type OptionsDataProvider,
    type OptionsSnapshot,
    type SlotMapping,
} from '@y0ngha/siglens-core';

/**
 * 수집 시점에 확정한 만기 슬롯 매핑을 함께 싣는 스냅샷.
 *
 * core `mapExpirationsToSlots`는 "지금(`now`)" 기준으로 가장 가까운 만기를 고른다. 어댑터는
 * 수집 시점에 슬롯 만기 체인만 내려받는데, 렌더가 몇 시간·며칠 묵은 스냅샷을 다시 `new Date()`로
 * 매핑하면 날짜가 밀려 다른 만기가 뽑히거나(토요일에 수집한 `0D`가 일요일에 사라지는 식) 내려받지
 * 않은 만기를 가리킨다. 그래서 수집 시점의 매핑을 스냅샷에 고정해 두고 렌더는 그 값을 쓴다.
 *
 * `slots`는 매핑이 있는 슬롯만 담는다(매핑 없는 슬롯 = chip 생략). 이 필드가 생기기 전에 캐시된
 * 스냅샷에는 없으므로 optional이다 — 읽는 쪽은 {@link resolveSnapshotSlots}만 쓴다.
 */
export interface SlottedOptionsSnapshot extends OptionsSnapshot {
    slots?: ReadonlyArray<SlotMapping>;
}

/** core `OptionsDataProvider`와 같되, 스냅샷에 수집 시점 슬롯 매핑을 실어 돌려준다. */
export interface SlottedOptionsDataProvider extends OptionsDataProvider {
    fetchSnapshot(symbol: string): Promise<SlottedOptionsSnapshot | null>;
}

/** `mapExpirationsToSlots`가 매핑 없는 슬롯에 채우는 `null`을 걸러내는 `filter` 타입 가드. */
export const isSlotMapping = (s: SlotMapping | null): s is SlotMapping =>
    s !== null;

/**
 * 렌더용 슬롯 목록. 수집 시점 매핑(`snapshot.slots`)을 우선 쓰되, 정리(last-good rebase 등)로
 * 체인이 사라진 만기의 chip은 뺀다. `slots`가 없는 옛 캐시 스냅샷만 현재 시각으로 다시 매핑한다.
 */
export function resolveSnapshotSlots(
    snapshot: SlottedOptionsSnapshot,
    now: Date
): SlotMapping[] {
    const chainDates = snapshot.chains.map(chain => chain.expirationDate);
    if (snapshot.slots === undefined) {
        return mapExpirationsToSlots(chainDates, now).filter(isSlotMapping);
    }
    const present = new Set(chainDates);
    return snapshot.slots.filter(mapping =>
        present.has(mapping.expirationDate)
    );
}
