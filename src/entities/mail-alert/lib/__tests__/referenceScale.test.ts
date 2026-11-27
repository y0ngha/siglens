import type { ChangeReference } from '@y0ngha/siglens-core';
import { describe, expect, it } from 'vitest';
import { PRICE_ALERT_SCALE_GUARD } from '@/entities/mail-alert/lib/priceAlertConstants';
import {
    hasLevels,
    referenceScaleHolds,
    scaleGuardedReference,
} from '@/entities/mail-alert/lib/referenceScale';

function reference(
    supports: readonly number[],
    resistances: readonly number[] = []
): ChangeReference {
    return {
        analyzedAt: '2026-11-18T21:00:00.000Z',
        supports,
        resistances,
        plan: null,
    };
}

describe('referenceScaleHolds', () => {
    const close = 100;

    it('가격들의 중앙값이 척도 가드 안이면 같은 척도로 본다', () => {
        expect(referenceScaleHolds(reference([95], [110]), close)).toBe(true);
    });

    it('분할 전 가격(지금 종가의 몇 배)이면 같은 척도가 아니다', () => {
        expect(referenceScaleHolds(reference([380], [420]), close)).toBe(false);
    });

    it('짝수 개면 위쪽 가운데 값으로 하한을 가른다(두 가운데의 평균이 아니다)', () => {
        // 비율 0.58, 0.605 — 위쪽 가운데 0.605는 하한 0.6 안, 평균 0.5925는 밖이다.
        const prices = reference([58, 60.5]);
        expect((58 + 60.5) / 2 / close).toBeLessThan(
            PRICE_ALERT_SCALE_GUARD.min
        );
        expect(referenceScaleHolds(prices, close)).toBe(true);
    });

    it('짝수 개면 위쪽 가운데 값으로 상한을 가른다(두 가운데의 평균이 아니다)', () => {
        // 비율 1.66, 1.68 — 평균 1.67은 상한 안, 위쪽 가운데 1.68은 밖이다.
        const prices = reference([166], [168]);
        expect((166 + 168) / 2 / close).toBeLessThanOrEqual(
            PRICE_ALERT_SCALE_GUARD.max
        );
        expect(referenceScaleHolds(prices, close)).toBe(false);
    });

    it('경계값은 안으로 친다', () => {
        expect(
            referenceScaleHolds(
                reference([PRICE_ALERT_SCALE_GUARD.min * close]),
                close
            )
        ).toBe(true);
        expect(
            referenceScaleHolds(
                reference([PRICE_ALERT_SCALE_GUARD.max * close]),
                close
            )
        ).toBe(true);
    });

    it('가격이 하나도 없거나 기준 종가가 없으면 견줄 근거가 없어 false', () => {
        expect(referenceScaleHolds(reference([]), close)).toBe(false);
        expect(referenceScaleHolds(reference([95]), undefined)).toBe(false);
        expect(referenceScaleHolds(reference([95]), 0)).toBe(false);
    });
});

describe('scaleGuardedReference', () => {
    it('척도가 맞으면 분석을 그대로 돌려준다', () => {
        const ref = reference([95], [110]);
        expect(scaleGuardedReference(ref, 100)).toBe(ref);
    });

    it('척도가 다르면 가격대와 계획만 비운다', () => {
        const ref = reference([380], [420]);
        expect(scaleGuardedReference(ref, 100)).toEqual({
            analyzedAt: ref.analyzedAt,
            supports: [],
            resistances: [],
            plan: null,
        });
    });
});

describe('hasLevels', () => {
    it('지지선·저항선·계획 중 하나라도 있으면 true', () => {
        expect(hasLevels(reference([95]))).toBe(true);
        expect(hasLevels(reference([], [110]))).toBe(true);
        expect(hasLevels(reference([]))).toBe(false);
    });
});
