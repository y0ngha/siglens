const mocks = vi.hoisted(() => ({
    fetchFinancialStatementsAll: vi.fn(),
    fetchStockTotalQuantity: vi.fn(),
    fetchCompanyInfo: vi.fn(),
    getKrDartCorp: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/shared/api/dart/dartClient', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/api/dart/dartClient')>()),
    fetchFinancialStatementsAll: mocks.fetchFinancialStatementsAll,
    fetchStockTotalQuantity: mocks.fetchStockTotalQuantity,
    fetchCompanyInfo: mocks.fetchCompanyInfo,
    isDartEnabled: () => true,
}));
vi.mock('@/entities/investor-flows/server/getKrDartCorp', () => ({
    getKrDartCorp: mocks.getKrDartCorp,
}));
vi.mock('@/shared/api/e2eEnv', () => ({ isE2E: () => false }));
vi.mock('@/shared/cache/getOrSetCache', () => ({
    getOrSetCache: async (
        _key: string,
        _ttl: unknown,
        fetcher: () => Promise<unknown>
    ) => fetcher(),
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveKrValuation } from '../../server/getKrValuation';
import alteogenAnnual from '../fixtures/alteogen-2025-annual-cfs.json';
import alteogenH1Shares from '../fixtures/alteogen-2026-h1-stock-totals.json';
import alteogenKrxRows from '../fixtures/alteogen-krx-stock-price-v2-rows.json';
import alteogenQ3Cfs from '../fixtures/alteogen-2026-q3-cfs.json';
import samsungCardQ3Shares from '../fixtures/samsungcard-2026-q3-stock-totals.json';

/**
 * 호출 경로 배선(TESTING.md#TE-11): 화면·에이전트가 부르는 `resolveKrValuation` → `getKrValuationInputs` → **실제** KRX 클라이언트
 * (`fetch`만 막는다) → `computeKrValuation`. KRX 갱신을 건너뛰거나 클라이언트 요청 모양이 어긋나면 이 테스트가 깨진다.
 * 네이버(2026-11-26, 2026.09 기준) EPS 3,027원·BPS 7,746원이 독립 정답이다.
 */
const NOW = new Date('2026-11-22T03:00:00Z');
const PRICE = { close: 169_600, date: '2026-11-25' };
const PROVIDER = { pe: 99, pb: 99, epsTtm: 1 };
const fetchSpy = vi.fn();

const krxResponse = (rows: readonly unknown[]) =>
    ({
        ok: true,
        status: 200,
        json: async () => ({
            response: {
                header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
                body: { totalCount: rows.length, items: { item: rows } },
            },
        }),
    }) as unknown as Response;

function installAlteogen() {
    mocks.getKrDartCorp.mockResolvedValue({
        corpCode: '00989619',
        corpName: '알테오젠',
        viaCommonShare: false,
    });
    mocks.fetchCompanyInfo.mockResolvedValue({ acc_mt: '12' });
    const statements: Record<string, readonly Record<string, unknown>[]> = {
        '2026/11014/CFS': alteogenQ3Cfs.list,
        '2025/11011/CFS': alteogenAnnual.list,
    };
    mocks.fetchFinancialStatementsAll.mockImplementation(
        async (_c: string, year: number, report: string, fsDiv: string) =>
            statements[`${year}/${report}/${fsDiv}`] ?? null
    );
    const shares: Record<string, readonly Record<string, unknown>[]> = {
        '2026/11012': alteogenH1Shares.list,
        '2026/11014': samsungCardQ3Shares.list,
    };
    mocks.fetchStockTotalQuantity.mockImplementation(
        async (_c: string, year: number, report: string) =>
            shares[`${year}/${report}`] ?? null
    );
}

describe('resolveKrValuation + 실제 KRX 클라이언트 (알테오젠 2026 무상증자)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('DATA_GO_KR_SERVICE_KEY', 'test-key');
        vi.stubGlobal('fetch', fetchSpy);
        installAlteogen();
    });
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('3분기 자기 표가 비면 9/30 KRX 상장주식수로 갱신해 PER·PBR 분모가 무상증자를 반영한다', async () => {
        fetchSpy.mockResolvedValue(krxResponse(alteogenKrxRows));
        const { valuation, transient } = await resolveKrValuation(
            '196170.KQ',
            PRICE,
            PROVIDER,
            NOW
        );
        expect(transient).toBe(false);
        expect(valuation.basis).toMatchObject({
            source: 'dart',
            sharesSource: 'dart_krx',
            sharesAsOf: '2026-09-30',
        });
        expect(valuation.epsTtm).toBeCloseTo(3_030.54, 1);
        expect(valuation.bps).toBeCloseTo(7_759.81, 1);
        expect(Math.abs((valuation.epsTtm ?? 0) / 3_027 - 1)).toBeLessThan(
            0.002
        );
        expect(Math.abs((valuation.bps ?? 0) / 7_746 - 1)).toBeLessThan(0.002);
        // 요청은 접두사 + 기간 말 이전 10일 범위 한 번이다.
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        const url = fetchSpy.mock.calls
            .map(([input]) => new URL(String(input)))
            .find(
                candidate =>
                    candidate.searchParams.get('likeSrtnCd') === '19617'
            );
        expect(url).toBeDefined();
        if (url === undefined) return;
        expect(url.searchParams.get('likeSrtnCd')).toBe('19617');
        expect(url.searchParams.get('beginBasDt')).toBe('20260920');
        expect(url.searchParams.get('endBasDt')).toBe('20261001');
    });

    it('KRX가 5xx여도 DART 표로 계산한 DART 값이 나오되 일시적으로 표시한다(제공처 값으로 내려가지 않는다)', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        fetchSpy.mockResolvedValue({ ok: false, status: 503 } as Response);
        const { valuation, transient } = await resolveKrValuation(
            '196170.KQ',
            PRICE,
            PROVIDER,
            NOW
        );
        // 낡은 주식수로 계산한 값이라 일시적이다 — 페이지 캐시(24h)에 굳히지 않는다(SERVER.md#SA-18).
        expect(transient).toBe(true);
        expect(valuation.basis).toMatchObject({
            source: 'dart',
            sharesSource: 'dart',
            sharesAsOf: '2026-06-30',
        });
        expect(valuation.pe).not.toBe(PROVIDER.pe);
        // 갱신 없이 H1 표(53,993,136주)를 쓰므로 EPS가 +30% 어긋난 채다 — 실패를 숨기지 않고 DART 표 그대로임을 sharesSource가 말한다.
        expect(valuation.epsTtm).toBeCloseTo(3_932.45, 1);
    });
});
