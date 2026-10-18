import { describe, expect, it } from 'vitest';
import { mapExpirationsToSlots, type SlotMapping } from '@y0ngha/siglens-core';
import {
    isSlotMapping,
    resolveSnapshotSlots,
    type SlottedOptionsSnapshot,
} from '../optionsSlots';

// 2026-10-17은 토요일, 10-18은 일요일(ET).
const SATURDAY = new Date('2026-10-17T16:00:00Z');
const SUNDAY = new Date('2026-10-18T16:00:00Z');
const EXPIRATIONS = [
    '2026-10-22',
    '2026-10-23',
    '2026-10-30',
    '2026-11-20',
    '2027-01-15',
];

const chain = (expirationDate: string) => ({
    expirationDate,
    daysToExpiration: 0,
    calls: [],
    puts: [],
});

function snapshotCapturedOn(
    capturedAt: Date,
    withSlots: boolean
): SlottedOptionsSnapshot {
    const slots = mapExpirationsToSlots(EXPIRATIONS, capturedAt).filter(
        isSlotMapping
    );
    return {
        symbol: 'AAPL',
        underlyingPrice: 100,
        capturedAt: capturedAt.toISOString(),
        chains: slots.map(s => chain(s.expirationDate)),
        ...(withSlots ? { slots } : {}),
    };
}

const keysOf = (mappings: readonly SlotMapping[]) =>
    mappings.map(m => `${m.slot.key}:${m.expirationDate}`);

describe('resolveSnapshotSlots', () => {
    it('토요일에 수집한 스냅샷을 일요일에 그려도 수집 시점의 chip을 그대로 쓴다', () => {
        const snapshot = snapshotCapturedOn(SATURDAY, true);
        const atCapture = mapExpirationsToSlots(EXPIRATIONS, SATURDAY).filter(
            isSlotMapping
        );

        const rendered = resolveSnapshotSlots(snapshot, SUNDAY);

        expect(rendered).toEqual(atCapture);
        expect(rendered.length).toBeGreaterThan(0);
    });

    it('같은 스냅샷을 현재 시각으로 다시 매핑하면 chip이 달라진다 — 저장 매핑이 필요한 이유', () => {
        const snapshot = snapshotCapturedOn(SATURDAY, false);

        const remapped = resolveSnapshotSlots(snapshot, SUNDAY);
        const stored = resolveSnapshotSlots(
            snapshotCapturedOn(SATURDAY, true),
            SUNDAY
        );

        expect(keysOf(remapped)).not.toEqual(keysOf(stored));
    });

    it('slots가 없는 옛 캐시 스냅샷은 체인 만기를 현재 시각으로 매핑하는 폴백을 쓴다', () => {
        const snapshot = snapshotCapturedOn(SATURDAY, false);
        const expected = mapExpirationsToSlots(
            snapshot.chains.map(c => c.expirationDate),
            SUNDAY
        ).filter(isSlotMapping);

        expect(resolveSnapshotSlots(snapshot, SUNDAY)).toEqual(expected);
    });

    it('체인이 사라진 만기의 chip은 뺀다(last-good rebase 등)', () => {
        const snapshot = snapshotCapturedOn(SATURDAY, true);
        const dropped = snapshot.slots![0]!.expirationDate;
        const trimmed: SlottedOptionsSnapshot = {
            ...snapshot,
            chains: snapshot.chains.filter(c => c.expirationDate !== dropped),
        };

        const rendered = resolveSnapshotSlots(trimmed, SUNDAY);

        expect(
            rendered.some(mapping => mapping.expirationDate === dropped)
        ).toBe(false);
        expect(rendered).toHaveLength(snapshot.slots!.length - 1);
    });

    it('매핑이 없는 슬롯(null)은 저장하지 않으므로 chip이 생략된다', () => {
        const snapshot: SlottedOptionsSnapshot = {
            symbol: 'AAPL',
            underlyingPrice: 100,
            capturedAt: SATURDAY.toISOString(),
            chains: [chain('2027-01-15')],
            slots: mapExpirationsToSlots(['2027-01-15'], SATURDAY).filter(
                isSlotMapping
            ),
        };

        const rendered = resolveSnapshotSlots(snapshot, SUNDAY);

        expect(rendered.every(isSlotMapping)).toBe(true);
        expect(rendered.length).toBeLessThan(6);
    });
});
