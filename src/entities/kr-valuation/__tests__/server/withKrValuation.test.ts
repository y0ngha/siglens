const mocks = vi.hoisted(() => ({ getKrValuationInputs: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('../../server/getKrValuationInputs', () => ({
    getKrValuationInputs: mocks.getKrValuationInputs,
}));
vi.mock('../../server/loadKrLastClose', () => ({ loadKrLastClose: vi.fn() }));

import type { FundamentalValuationMetrics } from '@y0ngha/siglens-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FundamentalProviderWithRawPeers } from '@/shared/api/fmp/fundamentalProvider.types';
import {
    extractShareTotals,
    extractStatementFigures,
} from '../../lib/dartAmounts';
import {
    resolveKrPageValuation,
    withKrValuation,
} from '../../server/withKrValuation';
import samsungCardAnnual from '../fixtures/samsungcard-2025-annual-cfs.json';
import samsungCardH1 from '../fixtures/samsungcard-2026-h1-cfs.json';
import samsungCardH1Shares from '../fixtures/samsungcard-2026-h1-stock-totals.json';

/** 제공처(yahoo)가 파생한 값 — DART 값과 눈에 띄게 다르다. PSR·PEG·EV/EBITDA는 DART가 만들지 않는다. */
const YAHOO: FundamentalValuationMetrics = {
    peRatioTTM: 7.38,
    priceToSalesRatioTTM: 1.36,
    pbRatioTTM: 0.4872,
    pegRatioTTM: 0.9,
    enterpriseValueOverEBITDATTM: 11.5,
    epsTTM: 5612.3,
};
const CLOSE = { close: 41_400, date: '2026-11-20' };
const NOW = new Date('2026-11-22T03:00:00Z');
const DART_OK = {
    kind: 'ok',
    data: {
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
    },
    transient: false,
};

/**
 * 클래스 인스턴스 provider — 실제 `CachedFundamentalProvider`처럼 메서드가 프로토타입에 있고 `this`를 쓴다. 객체 전개로는 이 메서드가
 * 복사되지 않으므로 래퍼가 위임을 깨면 테스트가 잡는다.
 */
class FakeProvider {
    readonly label = 'inner';
    keyMetrics: FundamentalValuationMetrics | null = YAHOO;
    async getKeyMetricsTtm(): Promise<FundamentalValuationMetrics | null> {
        return this.keyMetrics;
    }
    async getProfile(symbol: string) {
        return { symbol, companyName: this.label };
    }
}

const asProvider = (provider: FakeProvider) =>
    provider as unknown as FundamentalProviderWithRawPeers;

const deps = {
    loadClose: vi.fn(async () => CLOSE),
    now: () => NOW,
};

describe('withKrValuation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        deps.loadClose.mockResolvedValue(CLOSE);
        mocks.getKrValuationInputs.mockResolvedValue(DART_OK);
    });

    it('한국 종목의 PER·PBR·EPS를 DART 값으로 바꾸고 PSR·PEG·EV/EBITDA는 제공처 값을 그대로 둔다', async () => {
        const wrapped = withKrValuation(
            asProvider(new FakeProvider()),
            '029780.KS',
            deps
        );
        const metrics = await wrapped.getKeyMetricsTtm('029780.KS');
        expect(metrics?.peRatioTTM).toBeCloseTo(7.7268, 3);
        expect(metrics?.pbRatioTTM).toBeCloseTo(0.4961, 3);
        expect(metrics?.epsTTM).toBeCloseTo(5_357.983, 2);
        expect(metrics).toMatchObject({
            priceToSalesRatioTTM: 1.36,
            pegRatioTTM: 0.9,
            enterpriseValueOverEBITDATTM: 11.5,
        });
    });

    it('제공처 지표 값을 DART 계산의 대체값으로 넘기고 종가는 주입된 로더에서 가져온다', async () => {
        const wrapped = withKrValuation(
            asProvider(new FakeProvider()),
            '029780.KS',
            deps
        );
        await wrapped.getKeyMetricsTtm('029780.KS');
        expect(deps.loadClose).toHaveBeenCalledWith('029780.KS');
        expect(mocks.getKrValuationInputs).toHaveBeenCalledWith(
            '029780.KS',
            NOW,
            'request'
        );
    });

    it('미국·크립토 심볼은 원본 provider를 그대로 돌려준다(래퍼 없음)', () => {
        const inner = asProvider(new FakeProvider());
        expect(withKrValuation(inner, 'AAPL', deps)).toBe(inner);
        expect(mocks.getKrValuationInputs).not.toHaveBeenCalled();
    });

    it('DART를 쓸 수 없으면 제공처 지표 객체를 그대로 돌려준다', async () => {
        mocks.getKrValuationInputs.mockResolvedValue({
            kind: 'fallback',
            reason: 'dart_unavailable',
            transient: false,
        });
        const wrapped = withKrValuation(
            asProvider(new FakeProvider()),
            '029780.KS',
            deps
        );
        expect(await wrapped.getKeyMetricsTtm('029780.KS')).toBe(YAHOO);
    });

    it('제공처 지표가 없으면(null) DART를 부르지 않고 null이다', async () => {
        const inner = new FakeProvider();
        inner.keyMetrics = null;
        const wrapped = withKrValuation(asProvider(inner), '029780.KS', deps);
        expect(await wrapped.getKeyMetricsTtm('029780.KS')).toBeNull();
        expect(mocks.getKrValuationInputs).not.toHaveBeenCalled();
    });

    it('한국 종목이 아닌 심볼로 부르면 DART 없이 원본 값이다(래퍼가 한국 심볼용이어도)', async () => {
        const wrapped = withKrValuation(
            asProvider(new FakeProvider()),
            '029780.KS',
            deps
        );
        expect(await wrapped.getKeyMetricsTtm('AAPL')).toBe(YAHOO);
        expect(mocks.getKrValuationInputs).not.toHaveBeenCalled();
    });

    it('나머지 메서드는 원본 인스턴스에 묶어 위임하고 필드도 그대로 읽힌다', async () => {
        const wrapped = withKrValuation(
            asProvider(new FakeProvider()),
            '029780.KS',
            deps
        );
        expect(await wrapped.getProfile('029780.KS')).toEqual({
            symbol: '029780.KS',
            companyName: 'inner',
        });
        expect((wrapped as unknown as FakeProvider).label).toBe('inner');
    });
});

describe('withKrValuation mode', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        deps.loadClose.mockResolvedValue(CLOSE);
        mocks.getKrValuationInputs.mockResolvedValue(DART_OK);
    });

    it('프리웜이 `background`를 넘기면 입력 로더가 그 모드로 읽는다', async () => {
        const wrapped = withKrValuation(
            asProvider(new FakeProvider()),
            '029780.KS',
            { ...deps, mode: 'background' }
        );
        await wrapped.getKeyMetricsTtm('029780.KS');
        expect(mocks.getKrValuationInputs).toHaveBeenCalledWith(
            '029780.KS',
            NOW,
            'background'
        );
    });
});

describe('resolveKrPageValuation 일시적 주식수', () => {
    it('KRX 갱신 실패로 낡은 주식수를 쓴 DART 값은 transient로 페이지 로더에 전달된다', async () => {
        deps.loadClose.mockResolvedValue(CLOSE);
        mocks.getKrValuationInputs.mockResolvedValue({
            ...DART_OK,
            transient: true,
        });
        const page = await resolveKrPageValuation(
            asProvider(new FakeProvider()),
            '029780.KS',
            deps
        );
        expect(page.transient).toBe(true);
        expect(page.basis?.source).toBe('dart');
    });
});

describe('resolveKrPageValuation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        deps.loadClose.mockResolvedValue(CLOSE);
        mocks.getKrValuationInputs.mockResolvedValue(DART_OK);
    });

    it('지표와 기준을 같은 계산에서 함께 낸다(종가 날짜·순이익 기간이 값과 어긋나지 않는다)', async () => {
        const page = await resolveKrPageValuation(
            asProvider(new FakeProvider()),
            '029780.KS',
            deps
        );
        expect(page.metrics?.peRatioTTM).toBeCloseTo(7.7268, 3);
        expect(page.basis).toMatchObject({
            source: 'dart',
            statements: 'consolidated',
            ttmEnd: '2026-06-30',
            priceDate: '2026-11-20',
        });
        expect(page.transient).toBe(false);
        // 입력 로더는 한 번만 읽었다.
        expect(mocks.getKrValuationInputs).toHaveBeenCalledTimes(1);
    });

    it('DART를 못 쓰면 제공처 지표 그대로이고 기준은 provider다', async () => {
        mocks.getKrValuationInputs.mockResolvedValue({
            kind: 'fallback',
            reason: 'no_report',
            transient: false,
        });
        const page = await resolveKrPageValuation(
            asProvider(new FakeProvider()),
            '029780.KS',
            deps
        );
        expect(page.metrics).toBe(YAHOO);
        expect(page.basis?.source).toBe('provider');
        expect(page.transient).toBe(false);
    });

    it('일시적 대체(시한·오류)는 transient로 알린다', async () => {
        mocks.getKrValuationInputs.mockResolvedValue({
            kind: 'fallback',
            reason: 'dart_unavailable',
            transient: true,
        });
        const page = await resolveKrPageValuation(
            asProvider(new FakeProvider()),
            '029780.KS',
            deps
        );
        expect(page.transient).toBe(true);
        expect(page.metrics).toBe(YAHOO);
    });

    it('제공처 지표가 없으면 지표·기준 모두 null이고 DART를 읽지 않는다', async () => {
        const empty = new FakeProvider();
        empty.keyMetrics = null;
        expect(
            await resolveKrPageValuation(asProvider(empty), '029780.KS', deps)
        ).toEqual({ metrics: null, basis: null, transient: false });
        expect(mocks.getKrValuationInputs).not.toHaveBeenCalled();
    });
});
