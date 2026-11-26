const mocks = vi.hoisted(() => ({ getKrValuationInputs: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('../../server/getKrValuationInputs', () => ({
    getKrValuationInputs: mocks.getKrValuationInputs,
}));
vi.mock('../../server/loadKrLastClose', () => ({ loadKrLastClose: vi.fn() }));

import type {
    FundamentalPeerInput,
    FundamentalValuationMetrics,
} from '@y0ngha/siglens-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FundamentalProviderWithRawPeers } from '@/shared/api/fmp/fundamentalProvider.types';
import type { KrPrice } from '../../model';
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

const negate = <
    T extends {
        account_id: string;
        thstrm_amount: string;
        thstrm_add_amount?: string;
    },
>(
    rows: readonly T[]
): T[] =>
    rows.map(row =>
        row.account_id === 'ifrs-full_ProfitLoss'
            ? {
                  ...row,
                  thstrm_amount: `-${row.thstrm_amount}`,
                  thstrm_add_amount: row.thstrm_add_amount
                      ? `-${row.thstrm_add_amount}`
                      : row.thstrm_add_amount,
              }
            : row
    );
/** 실제 보고서 모양에서 당기순이익 행만 부호를 뒤집은 적자 입력 — TTM 순이익이 음수라 DART 기준 PER은 null이다. */
const DART_LOSS = {
    kind: 'ok',
    data: {
        current: extractStatementFigures(negate(samsungCardH1.list), {
            year: 2026,
            reportCode: '11012',
            fsDiv: 'CFS',
        }),
        priorAnnual: extractStatementFigures(negate(samsungCardAnnual.list), {
            year: 2025,
            reportCode: '11011',
            fsDiv: 'CFS',
        }),
        shares: extractShareTotals(samsungCardH1Shares.list),
    },
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
    peers: FundamentalPeerInput[] = [];
    getStockPeersCalls: string[] = [];
    async getStockPeers(symbol: string): Promise<FundamentalPeerInput[]> {
        this.getStockPeersCalls.push(symbol);
        return this.peers;
    }
    async getStockPeersRaw(symbol: string): Promise<FundamentalPeerInput[]> {
        return this.peers.map(p => ({
            ...p,
            label: `${this.label}:${symbol}`,
        }));
    }
    async getProfile(symbol: string) {
        return { symbol, companyName: this.label };
    }
}

const asProvider = (provider: FakeProvider) =>
    provider as unknown as FundamentalProviderWithRawPeers;

const deps = {
    loadClose: vi.fn<(symbol: string) => Promise<KrPrice | null>>(
        async () => CLOSE
    ),
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

    it('미국·크립토 주체의 getKeyMetricsTtm은 DART 없이 원본 값이다', async () => {
        const wrapped = withKrValuation(
            asProvider(new FakeProvider()),
            'AAPL',
            deps
        );
        expect(await wrapped.getKeyMetricsTtm('AAPL')).toBe(YAHOO);
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

const peer = (
    symbol: string,
    per: number | null,
    psr: number | null
): FundamentalPeerInput => ({
    symbol,
    companyName: `${symbol} Inc`,
    marketCap: 1_000_000,
    per,
    psr,
});

describe('withKrValuation getStockPeers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        deps.loadClose.mockResolvedValue(CLOSE);
        mocks.getKrValuationInputs.mockResolvedValue(DART_OK);
    });

    it('미국 주체의 한국 peer는 per만 DART 값으로 바뀌고 psr·나머지 필드는 그대로다', async () => {
        const inner = new FakeProvider();
        inner.peers = [peer('029780.KS', 31.4, 2.2)];
        const wrapped = withKrValuation(asProvider(inner), 'AAPL', deps);
        const [kr] = await wrapped.getStockPeers('AAPL');
        expect(kr?.per).toBeCloseTo(7.7268, 3);
        expect(kr).toMatchObject({
            symbol: '029780.KS',
            companyName: '029780.KS Inc',
            marketCap: 1_000_000,
            psr: 2.2,
        });
        expect(mocks.getKrValuationInputs).toHaveBeenCalledWith(
            '029780.KS',
            NOW,
            'request'
        );
        expect(deps.loadClose).toHaveBeenCalledWith('029780.KS');
    });

    it('미국 peer는 그대로이고 DART를 부르지 않으며 순서를 유지한다', async () => {
        const inner = new FakeProvider();
        const us = peer('MSFT', 28.1, 11.3);
        inner.peers = [us, peer('029780.KS', 31.4, 2.2), peer('NVDA', 40, 20)];
        const wrapped = withKrValuation(asProvider(inner), 'AAPL', deps);
        const result = await wrapped.getStockPeers('AAPL');
        expect(result.map(p => p.symbol)).toEqual([
            'MSFT',
            '029780.KS',
            'NVDA',
        ]);
        expect(result[0]).toBe(us);
        expect(result[2]?.per).toBe(40);
        expect(mocks.getKrValuationInputs).toHaveBeenCalledTimes(1);
    });

    it('DART를 쓸 수 없으면 한국 peer도 제공처 per 그대로다', async () => {
        mocks.getKrValuationInputs.mockResolvedValue({
            kind: 'fallback',
            reason: 'no_report',
            transient: false,
        });
        const inner = new FakeProvider();
        const kr = peer('029780.KS', 31.4, 2.2);
        inner.peers = [kr];
        const wrapped = withKrValuation(asProvider(inner), 'AAPL', deps);
        expect(await wrapped.getStockPeers('AAPL')).toEqual([kr]);
    });

    it('종가가 없으면(price_unavailable) 제공처 per를 남기고 나머지 peer는 계속된다', async () => {
        deps.loadClose.mockResolvedValueOnce(null);
        const inner = new FakeProvider();
        inner.peers = [
            peer('029780.KS', 31.4, 2.2),
            peer('005930.KS', 12.5, 1),
        ];
        const wrapped = withKrValuation(asProvider(inner), 'AAPL', deps);
        const result = await wrapped.getStockPeers('AAPL');
        expect(result.find(p => p.symbol === '029780.KS')?.per).toBe(31.4);
        expect(result.find(p => p.symbol === '005930.KS')?.per).toBeCloseTo(
            7.7268,
            3
        );
    });

    it('예기치 않은 오류는 경고 로그 후 그 peer만 제공처 per로 남긴다', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        deps.loadClose.mockRejectedValueOnce(new Error('boom'));
        const inner = new FakeProvider();
        inner.peers = [
            peer('029780.KS', 31.4, 2.2),
            peer('005930.KS', 12.5, 1),
        ];
        const wrapped = withKrValuation(asProvider(inner), 'AAPL', deps);
        const result = await wrapped.getStockPeers('AAPL');
        const calls = [...warn.mock.calls];
        warn.mockRestore();
        expect(result.find(p => p.symbol === '029780.KS')?.per).toBe(31.4);
        expect(
            calls.some(c => c[0] === '[kr-valuation] peer PER fallback:')
        ).toBe(true);
    });

    it('Next 동적 서버 오류는 삼키지 않고 그대로 전파한다', async () => {
        const dynamic = Object.assign(new Error('Dynamic server usage: x'), {
            digest: 'DYNAMIC_SERVER_USAGE',
        });
        deps.loadClose.mockRejectedValueOnce(dynamic);
        const inner = new FakeProvider();
        inner.peers = [peer('029780.KS', 31.4, 2.2)];
        const wrapped = withKrValuation(asProvider(inner), 'AAPL', deps);
        await expect(wrapped.getStockPeers('AAPL')).rejects.toBe(dynamic);
    });

    it('DART 기준 TTM이 적자이면 per는 null이 되고 psr은 그대로다', async () => {
        mocks.getKrValuationInputs.mockResolvedValue(DART_LOSS);
        const inner = new FakeProvider();
        inner.peers = [peer('029780.KS', 31.4, 2.2)];
        const wrapped = withKrValuation(asProvider(inner), 'AAPL', deps);
        const [kr] = await wrapped.getStockPeers('AAPL');
        expect(kr?.per).toBeNull();
        expect(kr?.psr).toBe(2.2);
    });

    it('request 모드는 한국 peer를 목록 순서로 앞의 3개만 DART로 환산한다', async () => {
        const inner = new FakeProvider();
        inner.peers = [
            peer('000010.KS', 21.1, 1),
            peer('MSFT', 28.1, 11.3),
            peer('000020.KS', 22.2, 1),
            peer('000030.KS', 23.3, 1),
            peer('000040.KS', 24.4, 1),
        ];
        const wrapped = withKrValuation(asProvider(inner), 'AAPL', deps);
        const result = await wrapped.getStockPeers('AAPL');
        expect(mocks.getKrValuationInputs).toHaveBeenCalledTimes(3);
        expect(result.find(p => p.symbol === '000030.KS')?.per).toBeCloseTo(
            7.7268,
            3
        );
        expect(result.find(p => p.symbol === '000040.KS')?.per).toBe(24.4);
    });

    it('background 모드는 한국 peer 전부를 환산하고 입력 로더에 background를 넘긴다', async () => {
        const inner = new FakeProvider();
        inner.peers = Array.from({ length: 5 }, (_, i) =>
            peer(`00${i}100.KS`, 30 + i, 1)
        );
        const wrapped = withKrValuation(asProvider(inner), 'AAPL', {
            ...deps,
            mode: 'background',
        });
        const result = await wrapped.getStockPeers('AAPL');
        expect(mocks.getKrValuationInputs).toHaveBeenCalledTimes(5);
        expect(mocks.getKrValuationInputs).toHaveBeenCalledWith(
            '004100.KS',
            NOW,
            'background'
        );
        expect(result.every(p => Math.abs((p.per ?? 0) - 7.7268) < 0.01)).toBe(
            true
        );
    });

    it('getStockPeersRaw는 원본 인스턴스에 묶여 그대로 위임된다', async () => {
        const inner = new FakeProvider();
        inner.peers = [peer('029780.KS', 31.4, 2.2)];
        const wrapped = withKrValuation(asProvider(inner), 'AAPL', deps);
        const raw = await wrapped.getStockPeersRaw('AAPL');
        expect(raw).toEqual([{ ...inner.peers[0], label: 'inner:AAPL' }]);
        expect(raw[0]?.per).toBe(31.4);
        expect(mocks.getKrValuationInputs).not.toHaveBeenCalled();
    });

    it('background 모드에서 한국 peer가 많아도 DART 동시 조회는 3건을 넘지 않는다', async () => {
        let active = 0;
        let maxActive = 0;
        mocks.getKrValuationInputs.mockImplementation(async () => {
            active += 1;
            maxActive = Math.max(maxActive, active);
            await new Promise(resolve => setTimeout(resolve, 5));
            active -= 1;
            return DART_OK;
        });
        const inner = new FakeProvider();
        inner.peers = Array.from({ length: 8 }, (_, i) =>
            peer(`00${i}000.KS`, 20 + i, 1)
        );
        const wrapped = withKrValuation(asProvider(inner), 'AAPL', {
            ...deps,
            mode: 'background',
        });
        const result = await wrapped.getStockPeers('AAPL');
        expect(result).toHaveLength(8);
        expect(maxActive).toBe(3);
    });

    it('한국 주체는 원본 getStockPeers를 그대로 위임한다(peer 없음 유지)', async () => {
        const inner = new FakeProvider();
        inner.peers = [];
        const wrapped = withKrValuation(asProvider(inner), '029780.KS', deps);
        expect(await wrapped.getStockPeers('029780.KS')).toBe(inner.peers);
        expect(mocks.getKrValuationInputs).not.toHaveBeenCalled();
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
