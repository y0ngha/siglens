const mocks = vi.hoisted(() => ({ getKrValuationInputs: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('../../server/getKrValuationInputs', () => ({
    getKrValuationInputs: mocks.getKrValuationInputs,
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    extractShareTotals,
    extractStatementFigures,
} from '../../lib/dartAmounts';
import {
    getKrValuation,
    resolveKrValuation,
} from '../../server/getKrValuation';
import samsungCardAnnual from '../fixtures/samsungcard-2025-annual-cfs.json';
import samsungCardH1 from '../fixtures/samsungcard-2026-h1-cfs.json';
import samsungCardH1Shares from '../fixtures/samsungcard-2026-h1-stock-totals.json';

const PROVIDER = { pe: 7.4, pb: 0.49, epsTtm: 5612 };
const PRICE = { close: 41_400, date: '2026-11-20' };
const DATA = {
    current: extractStatementFigures(samsungCardH1.list, {
        year: 2026,
        reportCode: '11012',
        fsDiv: 'CFS',
    }),
    priorAnnual: extractStatementFigures(samsungCardAnnual.list, {
        year: 2025,
        reportCode: '11011',
        fsDiv: 'CFS',
    }),
    shares: extractShareTotals(samsungCardH1Shares.list),
};

describe('getKrValuation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('DART 입력이 있으면 DART 기준 값과 기준을 돌려준다', async () => {
        mocks.getKrValuationInputs.mockResolvedValue({
            kind: 'ok',
            data: DATA,
        });
        const v = await getKrValuation('029780.KS', PRICE, PROVIDER);
        expect(v.basis.source).toBe('dart');
        expect(v.pe).toBeCloseTo(7.7268, 3);
        expect(v.epsTtm).toBeCloseTo(5_357.983, 2);
        // 제공처 값(7.4·5612)을 쓰지 않는다.
        expect(v.pe).not.toBe(PROVIDER.pe);
    });

    it('`now`를 입력 로더에 그대로 넘긴다', async () => {
        mocks.getKrValuationInputs.mockResolvedValue({
            kind: 'ok',
            data: DATA,
        });
        const now = new Date('2026-05-20T00:00:00Z');
        await getKrValuation('029780.KS', PRICE, PROVIDER, now);
        expect(mocks.getKrValuationInputs).toHaveBeenCalledWith(
            '029780.KS',
            now,
            'request'
        );
    });

    it('DART를 쓸 수 없으면 제공처 값을 그대로, 사유와 함께 돌려준다', async () => {
        mocks.getKrValuationInputs.mockResolvedValue({
            kind: 'fallback',
            reason: 'non_december_fiscal_year',
            transient: false,
        });
        const v = await getKrValuation('021820.KS', PRICE, PROVIDER);
        expect(v).toMatchObject({ pe: 7.4, pb: 0.49, epsTtm: 5612, bps: null });
        expect(v.basis.source).toBe('provider');
        expect(v.basis.note).toContain('does not end in December');
    });

    it('DART 숫자가 모자라 계산할 수 없으면(순이익·자본 모두 없음) incomplete_report로 제공처 값을 쓴다', async () => {
        mocks.getKrValuationInputs.mockResolvedValue({
            kind: 'ok',
            data: {
                ...DATA,
                current: { ...DATA.current, netIncomeYtd: null, equity: null },
            },
        });
        const v = await getKrValuation('029780.KS', PRICE, PROVIDER);
        expect(v.basis.source).toBe('provider');
        expect(v.basis.note).toContain('lacks the figures needed');
        expect(v.pe).toBe(7.4);
    });

    it('종가가 없으면 DART를 읽지 않고 제공처 값을 그대로 둔다(PER·PBR을 null로 만들지 않는다)', async () => {
        const v = await getKrValuation('029780.KS', null, PROVIDER);
        expect(mocks.getKrValuationInputs).not.toHaveBeenCalled();
        expect(v).toMatchObject({ pe: 7.4, pb: 0.49, epsTtm: 5612 });
        expect(v.basis.source).toBe('provider');
        expect(v.basis.note).toContain('last close was unavailable');
    });
});

describe('resolveKrValuation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('DART 값은 일시적이지 않다', async () => {
        mocks.getKrValuationInputs.mockResolvedValue({
            kind: 'ok',
            data: DATA,
        });
        const r = await resolveKrValuation('029780.KS', PRICE, PROVIDER);
        expect(r.transient).toBe(false);
        expect(r.valuation.basis.source).toBe('dart');
    });

    it('오류·시한으로 내려온 제공처 값은 일시적이다', async () => {
        mocks.getKrValuationInputs.mockResolvedValue({
            kind: 'fallback',
            reason: 'dart_unavailable',
            transient: true,
        });
        expect(
            (await resolveKrValuation('029780.KS', PRICE, PROVIDER)).transient
        ).toBe(true);
    });

    it('보고서 없음·12월 결산 아님처럼 정해진 답으로 내려온 제공처 값은 일시적이 아니다', async () => {
        mocks.getKrValuationInputs.mockResolvedValue({
            kind: 'fallback',
            reason: 'no_report',
            transient: false,
        });
        expect(
            (await resolveKrValuation('029780.KS', PRICE, PROVIDER)).transient
        ).toBe(false);
    });

    it('종가가 없으면 일시적이다(종가 로더가 실패했을 수 있다)', async () => {
        expect(
            (await resolveKrValuation('029780.KS', null, PROVIDER)).transient
        ).toBe(true);
    });

    it('`mode`를 입력 로더에 넘긴다', async () => {
        mocks.getKrValuationInputs.mockResolvedValue({
            kind: 'ok',
            data: DATA,
        });
        const now = new Date('2026-11-22T00:00:00Z');
        await resolveKrValuation(
            '029780.KS',
            PRICE,
            PROVIDER,
            now,
            'background'
        );
        expect(mocks.getKrValuationInputs).toHaveBeenCalledWith(
            '029780.KS',
            now,
            'background'
        );
    });
});
