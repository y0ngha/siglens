import { describe, expect, it } from 'vitest';
import { extractShareTotals } from '../../lib/dartAmounts';
import {
    refreshShareCounts,
    type KrxShareCounts,
} from '../../lib/refreshShareCounts';
import type { ShareKindCounts, ShareTotals } from '../../model';
import alteogenH1Shares from '../fixtures/alteogen-2026-h1-stock-totals.json';
import hanwhaH1Shares from '../fixtures/hanwhasolutions-2026-h1-stock-totals.json';

/** 종류별 줄의 합이 합계가 되는 표. 값은 단언의 리터럴과 겹치지 않는 임의 수다. */
function table(
    common: ShareKindCounts | null,
    preferred: ShareKindCounts | null,
    settledOn: string | null = '2026-06-30'
): ShareTotals {
    const kinds = [common, preferred];
    const sum = (field: keyof ShareKindCounts) =>
        kinds.reduce((total, kind) => total + (kind?.[field] ?? 0), 0);
    return {
        issued: sum('issued'),
        treasury: sum('treasury'),
        outstanding: sum('outstanding'),
        settledOn,
        source: 'dart',
        common,
        preferred,
        preferredIsMixed: false,
    };
}

const COMMON: ShareKindCounts = {
    issued: 1_000_000,
    treasury: 20_000,
    outstanding: 980_000,
};
const PREFERRED: ShareKindCounts = {
    issued: 300_000,
    treasury: 0,
    outstanding: 300_000,
};
const krx = (
    common: number,
    preferred: number | null = null,
    asOf = '2026-09-30'
): KrxShareCounts => ({ asOf, common, preferred });

describe('refreshShareCounts — Δ(상장주식수 − 발행주식 총수) 부호 규칙', () => {
    it('Δ ≥ 0 신주: 발행·유통 모두 +Δ, 자기주식은 그대로', () => {
        const result = refreshShareCounts(table(COMMON, null), krx(1_300_000));
        expect(result).toEqual({
            issued: 1_300_000,
            treasury: 20_000,
            outstanding: 1_280_000,
            settledOn: '2026-09-30',
            source: 'dart_krx',
            common: {
                issued: 1_300_000,
                treasury: 20_000,
                outstanding: 1_280_000,
            },
            preferred: null,
            preferredIsMixed: false,
        });
    });

    it('−자기주식 ≤ Δ < 0 소각: 발행만 줄고 유통은 그대로, 자기주식이 그만큼 준다', () => {
        const result = refreshShareCounts(table(COMMON, null), krx(990_000));
        expect(result.common).toEqual({
            issued: 990_000,
            treasury: 10_000,
            outstanding: 980_000,
        });
        expect(result.issued).toBe(990_000);
        expect(result.outstanding).toBe(980_000);
    });

    it('Δ = −자기주식 경계는 소각이다(자기주식이 0이 된다)', () => {
        const result = refreshShareCounts(table(COMMON, null), krx(980_000));
        expect(result.common).toEqual({
            issued: 980_000,
            treasury: 0,
            outstanding: 980_000,
        });
    });

    it('Δ < −자기주식 병합(1주→0.2주): 유통도 같은 비율로 준다', () => {
        const result = refreshShareCounts(table(COMMON, null), krx(200_000));
        expect(result.common).toEqual({
            issued: 200_000,
            treasury: 4_000,
            outstanding: 196_000,
        });
        expect(result.outstanding).toBe(196_000);
    });

    it('종류별로 따로 적용하고 합계는 `합계 + Σ변화`다(보통주 신주 + 우선주 소각)', () => {
        const preferred = {
            issued: 300_000,
            treasury: 5_000,
            outstanding: 295_000,
        };
        const result = refreshShareCounts(
            table(COMMON, preferred),
            krx(1_100_000, 297_000)
        );
        expect(result.issued).toBe(1_100_000 + 297_000);
        expect(result.treasury).toBe(20_000 + 2_000);
        expect(result.outstanding).toBe(1_080_000 + 295_000);
    });

    it('KRX가 우선주를 상장하지 않았으면(null) DART 우선주 줄을 그대로 둔다', () => {
        const result = refreshShareCounts(
            table(COMMON, PREFERRED),
            krx(1_300_000, null)
        );
        expect(result.preferred).toEqual(PREFERRED);
        expect(result.issued).toBe(1_300_000 + 300_000);
    });

    it('DART 표에 우선주 줄이 없으면 KRX 우선주 값은 무시한다', () => {
        const result = refreshShareCounts(
            table(COMMON, null),
            krx(1_300_000, 90_000)
        );
        expect(result.preferred).toBeNull();
        expect(result.issued).toBe(1_300_000);
    });

    it('종류로 분류되지 않는 줄이 합계에 있어도 합계 줄 값 위에 변화만 더한다', () => {
        const withExtra = {
            ...table(COMMON, null),
            issued: 1_050_000,
            outstanding: 1_030_000,
        };
        const result = refreshShareCounts(withExtra, krx(1_100_000));
        expect(result.issued).toBe(1_150_000);
        expect(result.outstanding).toBe(1_130_000);
    });

    it('모든 종류의 Δ가 0이면 DART 표를 그대로 돌려준다(출처는 dart)', () => {
        const dart = table(COMMON, PREFERRED);
        expect(refreshShareCounts(dart, krx(1_000_000, 300_000))).toBe(dart);
    });

    it('KRX 기준일이 표의 결산일보다 늦지 않으면 갱신하지 않는다', () => {
        const dart = table(COMMON, null);
        expect(
            refreshShareCounts(dart, krx(1_300_000, null, '2026-06-30'))
        ).toBe(dart);
        expect(
            refreshShareCounts(dart, krx(1_300_000, null, '2026-03-31'))
        ).toBe(dart);
        expect(
            refreshShareCounts(dart, krx(1_300_000, null, '2026-07-01')).source
        ).toBe('dart_krx');
    });

    it('결산일을 모르거나 보통주 줄을 못 읽은 표는 종류별로 가를 수 없어 그대로 둔다', () => {
        const unknownDate = table(COMMON, null, null);
        expect(refreshShareCounts(unknownDate, krx(1_300_000))).toBe(
            unknownDate
        );
        const noCommon = { ...table(COMMON, null), common: null };
        expect(refreshShareCounts(noCommon, krx(1_300_000))).toBe(noCommon);
    });

    it('KRX 상장주식수가 0 이하이면 그 종류는 건드리지 않는다', () => {
        const dart = table(COMMON, null);
        expect(refreshShareCounts(dart, krx(0))).toBe(dart);
    });
});

describe('refreshShareCounts — 우선주 계열 줄이 여럿(합성 값)', () => {
    it('우선주 줄이 둘 이상이면 KRX 상장 우선주 수와 범위가 달라 우선주는 갱신하지 않고 보통주만 갱신한다', () => {
        const mixed = { ...table(COMMON, PREFERRED), preferredIsMixed: true };
        const result = refreshShareCounts(mixed, krx(1_300_000, 120_000));
        expect(result.preferred).toEqual(PREFERRED);
        expect(result.common?.issued).toBe(1_300_000);
        expect(result.issued).toBe(1_300_000 + 300_000);
        expect(result.preferredIsMixed).toBe(true);
    });
});

describe('refreshShareCounts — 실제 DART 표(2026 반기)와 KRX 상장주식수', () => {
    it('한화솔루션: 보통주 유상증자(+53,000,000주)와 우선주 소각(자기주식 30,733주 전부)을 종류별로 반영한다', () => {
        const dart = extractShareTotals(hanwhaH1Shares.list);
        expect(dart).not.toBeNull();
        if (dart === null) return;
        const result = refreshShareCounts(dart, {
            asOf: '2026-09-30',
            common: 224_892_536,
            preferred: 2_544_616,
        });
        expect(result.common).toEqual({
            issued: 224_892_536,
            treasury: 2_437_481,
            outstanding: 222_455_055,
        });
        expect(result.preferred).toEqual({
            issued: 2_544_616,
            treasury: 0,
            outstanding: 2_544_616,
        });
        expect(result.issued).toBe(227_437_152);
        expect(result.outstanding).toBe(224_999_671);
        expect(result.settledOn).toBe('2026-09-30');
    });

    it('알테오젠: 비상장 종류주식(RCPS)은 KRX에 없어 DART 값을 지키고 보통주만 갱신한다', () => {
        const dart = extractShareTotals(alteogenH1Shares.list);
        expect(dart).not.toBeNull();
        if (dart === null) return;
        const result = refreshShareCounts(dart, {
            asOf: '2026-09-30',
            common: 69_655_133,
            preferred: null,
        });
        expect(result.preferred).toEqual(dart.preferred);
        expect(result.issued).toBe(70_061_926);
        expect(result.outstanding).toBe(70_038_218);
    });
});
