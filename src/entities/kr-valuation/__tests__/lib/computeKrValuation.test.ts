import { describe, expect, it } from 'vitest';
import {
    computeKrValuation,
    providerKrValuation,
    type KrValuationData,
} from '../../lib/computeKrValuation';
import {
    extractShareTotals,
    extractStatementFigures,
} from '../../lib/dartAmounts';
import { defined } from '@/shared/test-utils/defined';
import { refreshShareCounts } from '../../lib/refreshShareCounts';
import type { StatementFigures } from '../../model';
import samsungCardAnnual from '../fixtures/samsungcard-2025-annual-cfs.json';
import samsungCardH1 from '../fixtures/samsungcard-2026-h1-cfs.json';
import samsungCardH1Shares from '../fixtures/samsungcard-2026-h1-stock-totals.json';
import samsungCardQ1 from '../fixtures/samsungcard-2026-q1-cfs.json';
import samsungCardQ3 from '../fixtures/samsungcard-2026-q3-cfs.json';
import hpspShares from '../fixtures/hpsp-2026-h1-stock-totals.json';
import hpspH1Ofs from '../fixtures/hpsp-2026-h1-ofs.json';
import hpspAnnualOfs from '../fixtures/hpsp-2025-annual-ofs.json';

/**
 * 삼성카드(029780) 실 DART 응답에서 계산한 값을 네이버 증권(2026-11-22, 반기 기준) 표시값과 대조한다 — EPS 5,358원, BPS 83,446원.
 * 이 두 값은 구현이 쓰는 규칙(발행주식 총수 ÷ 순이익, 유통주식수 ÷ 자본)과 독립인 정답이다.
 */

const figures = (
    rows: readonly Record<string, unknown>[],
    year: number,
    reportCode: StatementFigures['reportCode'],
    fsDiv: StatementFigures['fsDiv'] = 'CFS'
): StatementFigures =>
    extractStatementFigures(rows, { year, reportCode, fsDiv });

const SAMSUNG_CARD_ANNUAL = figures(samsungCardAnnual.list, 2025, '11011');
const SAMSUNG_CARD_H1 = figures(samsungCardH1.list, 2026, '11012');
const SAMSUNG_CARD_SHARES = extractShareTotals(samsungCardH1Shares.list);

const HALF: KrValuationData = {
    current: SAMSUNG_CARD_H1,
    priorAnnual: SAMSUNG_CARD_ANNUAL,
    shares: SAMSUNG_CARD_SHARES,
    price: { close: 41_400, date: '2026-11-20' },
};

describe('TTM 순이익 (EPS × 발행주식 총수로 읽는다)', () => {
    const issued = SAMSUNG_CARD_SHARES?.issued ?? 0;
    const ttmOf = (patch: Partial<KrValuationData>): number | null => {
        const v = computeKrValuation({ ...HALF, ...patch });
        return v?.epsTtm == null ? null : v.epsTtm * issued;
    };

    it('반기: 당기 누적 + 직전 사업연도 − 전년 동기 누적', () => {
        // 310,487 + 645,923 − 335,640 (백만 원)
        expect(ttmOf({})).toBeCloseTo(620_770_000_000, -2);
    });

    it('1분기·3분기도 같은 식이다', () => {
        expect(
            ttmOf({ current: figures(samsungCardQ1.list, 2026, '11013') })
        ).toBeCloseTo(156_284e6 + 645_923e6 - 184_440e6, -2);
        expect(
            ttmOf({ current: figures(samsungCardQ3.list, 2026, '11014') })
        ).toBeCloseTo(450_303e6 + 645_923e6 - 497_329e6, -2);
    });

    it('사업보고서면 그 해 순이익이고 직전 연도는 필요 없다', () => {
        expect(
            ttmOf({ current: SAMSUNG_CARD_ANNUAL, priorAnnual: null })
        ).toBeCloseTo(645_923_000_000, -2);
    });

    it.each([
        ['직전 사업연도 없음', { priorAnnual: null }],
        [
            '직전 연도가 바로 앞 해가 아님',
            { priorAnnual: { ...SAMSUNG_CARD_ANNUAL, year: 2024 } },
        ],
        [
            '직전 보고서가 사업보고서가 아님',
            {
                priorAnnual: {
                    ...SAMSUNG_CARD_ANNUAL,
                    reportCode: '11012' as const,
                },
            },
        ],
        [
            '직전 연도 순이익 없음',
            { priorAnnual: { ...SAMSUNG_CARD_ANNUAL, netIncomeYtd: null } },
        ],
        [
            '당기 누적 없음',
            { current: { ...SAMSUNG_CARD_H1, netIncomeYtd: null } },
        ],
        [
            '전년 동기 누적 없음',
            { current: { ...SAMSUNG_CARD_H1, netIncomePriorYtd: null } },
        ],
    ])(
        '%s이면 TTM을 못 만들어 EPS·PER이 null(missing)이고 PBR은 그대로다',
        (_, patch) => {
            const v = computeKrValuation({ ...HALF, ...patch });
            expect(v?.epsTtm).toBeNull();
            expect(v?.pe).toBeNull();
            expect(v?.nullReason).toEqual({ pe: 'missing' });
            expect(v?.pb).not.toBeNull();
        }
    );
});

describe('computeKrValuation (삼성카드 2026 반기)', () => {
    it('EPS는 발행주식 총수, BPS는 유통주식수로 나눠 네이버 값(5,358원·83,446원)과 맞는다', () => {
        const v = computeKrValuation(HALF);
        // 620,770,000,000 / 115,858,891 — 자기주식(9,148,196주)을 빼지 않는다.
        expect(v?.epsTtm).toBeCloseTo(5_357.983, 2);
        expect(v?.epsTtm).toBeGreaterThan(5_357.5);
        expect(v?.epsTtm).toBeLessThan(5_358.5);
        // 8,904,529,000,000 / 106,710,695 — 자기주식을 뺀 유통주식수.
        expect(v?.bps).toBeCloseTo(83_445.516, 2);
    });

    it('PER·PBR은 종가 ÷ EPS·BPS이고 반올림하지 않는다', () => {
        const v = computeKrValuation(HALF);
        expect(v?.pe).toBeCloseTo(7.7268, 3);
        expect(v?.pb).toBeCloseTo(0.4961, 3);
        expect(v?.nullReason).toEqual({});
    });

    it('기준을 밝힌다: DART 연결, 순이익 기간, 자본 기준일, 주식수, 종가 날짜', () => {
        const v = computeKrValuation(HALF);
        expect(v?.basis).toMatchObject({
            source: 'dart',
            statements: 'consolidated',
            ttmEnd: '2026-06-30',
            equityAsOf: '2026-06-30',
            epsShares: 'issued_incl_treasury',
            bpsShares: 'outstanding_ex_treasury',
            sharesAsOf: '2026-06-30',
            sharesSource: 'dart',
            priceDate: '2026-11-20',
        });
        expect(v?.basis.note).toBe(
            'P/E = the 2026-11-20 close / trailing-4-quarter DART consolidated controlling-interest EPS to 2026-06-30 (net income per issued share, common and preferred, treasury shares included); P/B = the 2026-11-20 close / DART consolidated controlling-interest equity at 2026-06-30 per outstanding share (common and preferred, treasury shares excluded).'
        );
    });

    it('별도 재무제표(OFS)면 statements가 separate이고 문구도 그렇게 말한다', () => {
        const v = computeKrValuation({
            current: figures(hpspH1Ofs.list, 2026, '11012', 'OFS'),
            priorAnnual: figures(hpspAnnualOfs.list, 2025, '11011', 'OFS'),
            shares: extractShareTotals(hpspShares.list),
            price: { close: 37_800, date: '2026-11-20' },
        });
        expect(v?.basis.statements).toBe('separate');
        expect(v?.basis.note).toContain('DART separate-statement');
        expect(v?.basis.note).not.toContain('consolidated');
        // (48,968,939,225 + 72,662,225,546 − 35,904,573,401) / 82,300,000
        expect(v?.epsTtm).toBeCloseTo(1_041.635, 2);
    });

    it('1분기·3분기 보고서도 계산한다(주식수는 호출부가 앞선 보고서에서 가져온다)', () => {
        const q1 = computeKrValuation({
            ...HALF,
            current: figures(samsungCardQ1.list, 2026, '11013'),
        });
        expect(q1?.basis.ttmEnd).toBe('2026-03-31');
        expect(q1?.epsTtm).toBeCloseTo(617_767_000_000 / 115_858_891, 4);
        const q3 = computeKrValuation({
            ...HALF,
            current: figures(samsungCardQ3.list, 2026, '11014'),
        });
        expect(q3?.basis.equityAsOf).toBe('2026-09-30');
        expect(q3?.epsTtm).toBeCloseTo(598_897_000_000 / 115_858_891, 4);
    });

    it('사업보고서는 직전 연도 없이 한 해 순이익으로 계산한다', () => {
        const v = computeKrValuation({
            ...HALF,
            current: SAMSUNG_CARD_ANNUAL,
            priorAnnual: null,
        });
        expect(v?.basis.ttmEnd).toBe('2025-12-31');
        expect(v?.epsTtm).toBeCloseTo(645_923_000_000 / 115_858_891, 4);
    });

    it('순이익이 0 이하면 PER은 null이고 loss 사유를 단다(EPS는 음수로 낸다)', () => {
        const v = computeKrValuation({
            ...HALF,
            current: { ...SAMSUNG_CARD_H1, netIncomeYtd: -900_000_000_000 },
        });
        expect(v?.pe).toBeNull();
        expect(v?.epsTtm).toBeLessThan(0);
        expect(v?.nullReason).toEqual({ pe: 'loss' });
        expect(v?.pb).not.toBeNull();
    });

    it('자본이 0 이하면 PBR은 null이고 negative_equity 사유를 단다', () => {
        const v = computeKrValuation({
            ...HALF,
            current: { ...SAMSUNG_CARD_H1, equity: -1_000_000_000 },
        });
        expect(v?.pb).toBeNull();
        expect(v?.bps).toBeLessThan(0);
        expect(v?.nullReason).toEqual({ pb: 'negative_equity' });
        expect(v?.pe).not.toBeNull();
    });

    it('직전 사업연도가 없으면(상장 1년 미만 등) PER은 missing, PBR은 그대로, ttmEnd는 null이다', () => {
        const v = computeKrValuation({ ...HALF, priorAnnual: null });
        expect(v?.pe).toBeNull();
        expect(v?.epsTtm).toBeNull();
        expect(v?.nullReason).toEqual({ pe: 'missing' });
        expect(v?.pb).toBeCloseTo(0.4961, 3);
        expect(v?.basis.ttmEnd).toBeNull();
        expect(v?.basis.note).toContain('P/E is unavailable');
    });

    it('주식수를 못 구하면 EPS·BPS·PER·PBR이 모두 missing이다', () => {
        const v = computeKrValuation({ ...HALF, shares: null });
        expect(v).toMatchObject({
            pe: null,
            pb: null,
            epsTtm: null,
            bps: null,
            nullReason: { pe: 'missing', pb: 'missing' },
        });
        expect(v?.basis.sharesAsOf).toBeNull();
        expect(v?.basis.sharesSource).toBeNull();
    });

    it('KRX 상장주식수로 갱신한 주식수는 출처·기준일을 밝히고 EPS·BPS 분모로 쓴다', () => {
        const refreshed = refreshShareCounts(defined(SAMSUNG_CARD_SHARES), {
            asOf: '2026-09-30',
            common: 118_000_000,
            preferred: null,
        });
        const v = computeKrValuation({ ...HALF, shares: refreshed });
        expect(v?.basis).toMatchObject({
            sharesSource: 'dart_krx',
            sharesAsOf: '2026-09-30',
        });
        expect(v?.basis.note).toContain(
            'Share counts are the DART share table updated to the KRX listed share count of 2026-09-30'
        );
        expect(v?.epsTtm).toBeCloseTo(620_770e6 / 118_000_000, 6);
        expect(v?.bps).toBeCloseTo(8_904_529e6 / (106_710_695 + 2_141_109), 6);
    });

    it('DART 표 그대로인 주식수에는 KRX 문구가 붙지 않는다', () => {
        expect(computeKrValuation(HALF)?.basis.note).not.toContain('KRX');
    });

    it.each([
        ['종가 없음', null],
        ['종가 0', { close: 0, date: '2026-11-20' }],
    ])('%s이면 PER·PBR은 missing이지만 EPS·BPS는 낸다', (_, price) => {
        const v = computeKrValuation({ ...HALF, price });
        expect(v?.pe).toBeNull();
        expect(v?.pb).toBeNull();
        expect(v?.nullReason).toEqual({ pe: 'missing', pb: 'missing' });
        expect(v?.epsTtm).toBeCloseTo(5_357.983, 2);
        expect(v?.bps).toBeCloseTo(83_445.516, 2);
        expect(v?.basis.priceDate).toBeNull();
        expect(v?.basis.note).toContain('the latest close');
    });

    it('종가 날짜를 모르면 priceDate는 null이다', () => {
        expect(
            computeKrValuation({
                ...HALF,
                price: { close: 41_400, date: null },
            })?.basis.priceDate
        ).toBeNull();
    });

    it('순이익도 자본도 못 읽었으면 null을 돌려 호출부가 제공처 값으로 돌아가게 한다', () => {
        expect(
            computeKrValuation({
                ...HALF,
                current: {
                    ...SAMSUNG_CARD_H1,
                    netIncomeYtd: null,
                    equity: null,
                },
            })
        ).toBeNull();
    });
});

describe('providerKrValuation', () => {
    const PROVIDER = { pe: 7.376, pb: 0.4872, epsTtm: 5612.3 };

    it('제공처 값을 다시 곱하지 않고 그대로 내고 provider 기준임을 밝힌다', () => {
        const v = providerKrValuation(PROVIDER, 'dart_unavailable');
        expect(v).toMatchObject({
            pe: 7.376,
            pb: 0.4872,
            epsTtm: 5612.3,
            bps: null,
            nullReason: {},
        });
        expect(v.basis).toMatchObject({
            source: 'provider',
            statements: null,
            ttmEnd: null,
            equityAsOf: null,
            epsShares: 'provider_implied',
            bpsShares: 'provider_implied',
            sharesAsOf: null,
            sharesSource: null,
            priceDate: null,
        });
    });

    it.each([
        ['dart_unavailable', 'DART could not be read'],
        ['not_covered', 'no DART corporation code'],
        ['no_report', 'No DART periodic report was found'],
        ['non_december_fiscal_year', 'does not end in December'],
        ['incomplete_report', 'lacks the figures needed'],
    ] as const)('%s 사유는 문구에 드러난다', (reason, fragment) => {
        expect(providerKrValuation(PROVIDER, reason).basis.note).toContain(
            fragment
        );
    });

    it('제공처 PER이 비었을 때 EPS가 음수면 loss, 아니면 missing이다', () => {
        expect(
            providerKrValuation(
                { pe: null, pb: 0.5, epsTtm: -120 },
                'dart_unavailable'
            ).nullReason
        ).toEqual({ pe: 'loss' });
        expect(
            providerKrValuation(
                { pe: null, pb: 0.5, epsTtm: null },
                'dart_unavailable'
            ).nullReason
        ).toEqual({ pe: 'missing' });
    });

    it('제공처 PBR이 비었으면 missing이다', () => {
        expect(
            providerKrValuation(
                { pe: 7, pb: null, epsTtm: 100 },
                'dart_unavailable'
            ).nullReason
        ).toEqual({ pb: 'missing' });
    });
});
