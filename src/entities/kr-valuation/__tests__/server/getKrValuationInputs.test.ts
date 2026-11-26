const mocks = vi.hoisted(() => ({
    fetchFinancialStatementsAll: vi.fn(),
    fetchStockTotalQuantity: vi.fn(),
    fetchCompanyInfo: vi.fn(),
    isDartEnabled: vi.fn(),
    getKrDartCorp: vi.fn(),
    isE2E: vi.fn(),
    fetchKrxListedItems: vi.fn(),
    hasDataGoKrCredentials: vi.fn(),
    cacheTtls: new Map<string, number>(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/shared/api/dart/dartClient', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/api/dart/dartClient')>()),
    fetchFinancialStatementsAll: mocks.fetchFinancialStatementsAll,
    fetchStockTotalQuantity: mocks.fetchStockTotalQuantity,
    fetchCompanyInfo: mocks.fetchCompanyInfo,
    isDartEnabled: mocks.isDartEnabled,
}));
vi.mock('@/entities/investor-flows/server/getKrDartCorp', () => ({
    getKrDartCorp: mocks.getKrDartCorp,
}));
vi.mock('@/shared/api/dataGoKr/krxListedInfoClient', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@/shared/api/dataGoKr/krxListedInfoClient')
    >()),
    fetchKrxListedItemsOnOrBefore: mocks.fetchKrxListedItems,
    hasDataGoKrCredentials: mocks.hasDataGoKrCredentials,
}));
vi.mock('@/shared/api/e2eEnv', () => ({ isE2E: mocks.isE2E }));
// 캐시 계층은 fetcher를 그대로 실행하고, 값에 따라 정해진 TTL을 키별로 기록한다.
vi.mock('@/shared/cache/getOrSetCache', () => ({
    getOrSetCache: async (
        key: string,
        ttl: number | ((value: unknown) => number),
        fetcher: () => Promise<unknown>
    ) => {
        const value = await fetcher();
        mocks.cacheTtls.set(key, typeof ttl === 'function' ? ttl(value) : ttl);
        return value;
    },
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DartQuotaError } from '@/shared/api/dart/dartClient';
import type { KrxListedItem } from '@/shared/api/dataGoKr/krxListedInfoClient';
import { computeKrValuation } from '../../lib/computeKrValuation';
import { getKrValuationInputs } from '../../server/getKrValuationInputs';
import samsungCardAnnual from '../fixtures/samsungcard-2025-annual-cfs.json';
import samsungCardCompany from '../fixtures/samsungcard-company.json';
import samsungCardH1 from '../fixtures/samsungcard-2026-h1-cfs.json';
import samsungCardH1Shares from '../fixtures/samsungcard-2026-h1-stock-totals.json';
import samsungCardQ1 from '../fixtures/samsungcard-2026-q1-cfs.json';
import samsungCardQ3 from '../fixtures/samsungcard-2026-q3-cfs.json';
import samsungCardQ3Shares from '../fixtures/samsungcard-2026-q3-stock-totals.json';
import hpspAnnualOfs from '../fixtures/hpsp-2025-annual-ofs.json';
import hpspH1Ofs from '../fixtures/hpsp-2026-h1-ofs.json';
import hpspShares from '../fixtures/hpsp-2026-h1-stock-totals.json';
import alteogenAnnual from '../fixtures/alteogen-2025-annual-cfs.json';
import alteogenH1Shares from '../fixtures/alteogen-2026-h1-stock-totals.json';
import alteogenKrxRows from '../fixtures/alteogen-krx-stock-price-v2-rows.json';
import alteogenQ3Cfs from '../fixtures/alteogen-2026-q3-cfs.json';
import alteogenQ3Shares from '../fixtures/alteogen-2026-q3-stock-totals.json';
import samsungCardAnnualShares from '../fixtures/samsungcard-2025-annual-stock-totals.json';
import samsungCardKrxRows from '../fixtures/samsungcard-krx-stock-price-v2-rows.json';
import samsungCardQ1Shares from '../fixtures/samsungcard-2026-q1-stock-totals.json';
import skHynixQ3Shares from '../fixtures/skhynix-2026-q3-stock-totals.json';

const CORP = '00126292';
const DAY = 86_400;
/** 찾은 값은 30일, 마감 전에 없는 값은 3일, 마감 후에 없는 값은 7일 캐시한다. */
const FOUND_TTL = 30 * DAY;
const MISSING_BEFORE_DEADLINE_TTL = 3 * DAY;
const MISSING_AFTER_DEADLINE_TTL = 7 * DAY;
const key = {
    statements: (year: number, report: string, fsDiv: string) =>
        `dart:fs:v1:${CORP}:${year}:${report}:${fsDiv}`,
    shares: (year: number, report: string) =>
        `dart:stock-totqy:v2:${CORP}:${year}:${report}`,
    krx: (prefix: string, periodEnd: string) =>
        `krx:listed-shares:v1:${prefix}:${periodEnd}`,
    company: `dart:company:v1:${CORP}`,
};
const SYMBOL = '029780.KS';
/** 2026-11-22 12:00 KST. 3분기(9/30) 보고서가 이미 후보 맨 앞이다. */
const NOW = new Date('2026-11-22T03:00:00Z');

type Statements = readonly Record<string, unknown>[] | null;

/** 보고서 키(`<year>/<reprt>/<fsDiv>`)별 응답. 없는 키는 `013`(null)이다. */
interface World {
    statements: Record<string, Statements>;
    shares: Record<string, Statements>;
    /** `<5자리 접두사>/<YYYYMMDD 기간 말>` → 그 기간 말 이하 마지막 거래일의 KRX 행. 없는 키는 빈 응답이다. */
    krx?: Record<string, readonly KrxListedItem[]>;
    accMt: string | null;
}

const WORLD: World = {
    accMt: samsungCardCompany.acc_mt,
    statements: {
        '2026/11014/CFS': samsungCardQ3.list,
        '2026/11012/CFS': samsungCardH1.list,
        '2026/11013/CFS': samsungCardQ1.list,
        '2025/11011/CFS': samsungCardAnnual.list,
    },
    shares: {
        '2026/11012': samsungCardH1Shares.list,
        '2026/11014': samsungCardQ3Shares.list,
    },
};

function install(world: World) {
    mocks.fetchCompanyInfo.mockImplementation(async () =>
        world.accMt === null ? null : { acc_mt: world.accMt }
    );
    mocks.fetchFinancialStatementsAll.mockImplementation(
        async (_corp: string, year: number, report: string, fsDiv: string) =>
            world.statements[`${year}/${report}/${fsDiv}`] ?? null
    );
    mocks.fetchStockTotalQuantity.mockImplementation(
        async (_corp: string, year: number, report: string) =>
            world.shares[`${year}/${report}`] ?? null
    );
    mocks.hasDataGoKrCredentials.mockReturnValue(true);
    mocks.fetchKrxListedItems.mockImplementation(
        async (prefix: string, basDt: string) =>
            world.krx?.[`${prefix}/${basDt}`] ?? []
    );
}

/** 실제 주식시세 V2 행(`__tests__/fixtures`)을 클라이언트가 만드는 `KrxListedItem` 모양으로 옮긴다. */
const krxItems = (
    rows: readonly {
        basDt: string;
        srtnCd: string;
        itmsNm: string;
        mrktCtg: string;
        isinCd: string;
        lstgStCnt: string;
    }[],
    basDt: string
): KrxListedItem[] =>
    rows
        .filter(row => row.basDt === basDt)
        .map(row => ({
            shortCode: row.srtnCd,
            koreanName: row.itmsNm,
            market: row.mrktCtg as KrxListedItem['market'],
            isin: row.isinCd,
            corpName: row.itmsNm,
            basDt: row.basDt,
            listedShares: Number(row.lstgStCnt),
        }));

/** 이 테스트가 `prefix`·`basDt`로 부른 KRX 조회 수(인자로 찾는다, TE-27). */
const krxCalls = (prefix: string, basDt: string): number =>
    mocks.fetchKrxListedItems.mock.calls.filter(
        ([p, d]) => p === prefix && d === basDt
    ).length;

/** 이 테스트가 `year/report/fsDiv`로 부른 재무제표 요청 수(호출 순서가 아니라 인자로 찾는다, TESTING.md#TE-27). */
const statementCalls = (year: number, report: string, fsDiv: string): number =>
    mocks.fetchFinancialStatementsAll.mock.calls.filter(
        ([, y, r, d]) => y === year && r === report && d === fsDiv
    ).length;

const shareCalls = (year: number, report: string): number =>
    mocks.fetchStockTotalQuantity.mock.calls.filter(
        ([, y, r]) => y === year && r === report
    ).length;

describe('getKrValuationInputs', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.cacheTtls.clear();
        mocks.isE2E.mockReturnValue(false);
        mocks.isDartEnabled.mockReturnValue(true);
        mocks.getKrDartCorp.mockResolvedValue({
            corpCode: CORP,
            corpName: '삼성카드',
            viaCommonShare: false,
        });
        install(WORLD);
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('가장 최근 보고서(3분기)와 직전 사업연도, 주식수(반기 표)를 읽는다', async () => {
        const result = await getKrValuationInputs(SYMBOL, NOW);
        expect(result.kind).toBe('ok');
        if (result.kind !== 'ok') return;
        expect(result.data.current).toMatchObject({
            year: 2026,
            reportCode: '11014',
            fsDiv: 'CFS',
            netIncomeYtd: 450_303_000_000,
        });
        expect(result.data.priorAnnual).toMatchObject({
            year: 2025,
            reportCode: '11011',
            netIncomeYtd: 645_923_000_000,
        });
        // 3분기 보고서 자신의 주식 표가 비어 있어(`-`) 같은 해 반기 표를 쓴다(자기 표를 먼저 본 뒤다).
        expect(result.data.shares).toMatchObject({
            issued: 115_858_891,
            outstanding: 106_710_695,
            settledOn: '2026-06-30',
            source: 'dart',
        });
        expect(shareCalls(2026, '11014')).toBe(1);
        expect(shareCalls(2026, '11012')).toBe(1);
    });

    it('DART 호출은 캐시 키로 감싸고 찾은 값은 30일 캐시한다', async () => {
        await getKrValuationInputs(SYMBOL, NOW);
        expect(mocks.cacheTtls.get(key.company)).toBe(FOUND_TTL);
        expect(mocks.cacheTtls.get(key.statements(2026, '11014', 'CFS'))).toBe(
            FOUND_TTL
        );
        expect(mocks.cacheTtls.get(key.statements(2025, '11011', 'CFS'))).toBe(
            FOUND_TTL
        );
        expect(mocks.cacheTtls.get(key.shares(2026, '11012'))).toBe(FOUND_TTL);
        expect(key.statements(2026, '11014', 'CFS')).toBe(
            'dart:fs:v1:00126292:2026:11014:CFS'
        );
        expect(key.shares(2026, '11012')).toBe(
            'dart:stock-totqy:v2:00126292:2026:11012'
        );
    });

    it('마감이 지났는데도 없는 보고서(013)는 이레만 캐시하고 다음 후보를 읽는다', async () => {
        install({
            ...WORLD,
            statements: {
                '2026/11012/CFS': samsungCardH1.list,
                '2025/11011/CFS': samsungCardAnnual.list,
            },
        });
        const result = await getKrValuationInputs(SYMBOL, NOW);
        expect(result.kind === 'ok' && result.data.current.reportCode).toBe(
            '11012'
        );
        // 3분기는 연결·별도 둘 다 없다.
        expect(statementCalls(2026, '11014', 'CFS')).toBe(1);
        expect(statementCalls(2026, '11014', 'OFS')).toBe(1);
        expect(mocks.cacheTtls.get(key.statements(2026, '11014', 'CFS'))).toBe(
            MISSING_AFTER_DEADLINE_TTL
        );
        expect(mocks.cacheTtls.get(key.statements(2026, '11014', 'OFS'))).toBe(
            MISSING_AFTER_DEADLINE_TTL
        );
    });

    it('마감 전에 아직 없는 보고서(013)는 사흘만 캐시한다 — 일찍 내는 회사를 며칠 안에 잡는다', async () => {
        install({
            ...WORLD,
            statements: {
                '2026/11012/CFS': samsungCardH1.list,
                '2025/11011/CFS': samsungCardAnnual.list,
            },
        });
        // 2026-11-05: 3분기 공시 창(10/24~)이 열렸지만 마감(11/14) 전이다.
        await getKrValuationInputs(SYMBOL, new Date('2026-11-05T03:00:00Z'));
        expect(mocks.cacheTtls.get(key.statements(2026, '11014', 'CFS'))).toBe(
            MISSING_BEFORE_DEADLINE_TTL
        );
    });

    it('공시 창이 열리기 전 보고서는 묻지 않는다 — 10월 중순에는 3분기 대신 반기를 읽는다', async () => {
        const result = await getKrValuationInputs(
            SYMBOL,
            new Date('2026-10-10T03:00:00Z')
        );
        expect(result.kind === 'ok' && result.data.current.reportCode).toBe(
            '11012'
        );
        expect(statementCalls(2026, '11014', 'CFS')).toBe(0);
        expect(statementCalls(2026, '11014', 'OFS')).toBe(0);
    });

    it('후보 날짜는 `now`(KST)가 정한다 — 5월 중순이면 1분기 보고서가 맨 앞이다', async () => {
        const result = await getKrValuationInputs(
            SYMBOL,
            new Date('2026-05-20T03:00:00Z')
        );
        expect(result.kind === 'ok' && result.data.current).toMatchObject({
            year: 2026,
            reportCode: '11013',
        });
        // 1분기는 반기가 아직 없으니 전년 사업보고서의 주식 표를 쓴다 — 그 해 반기를 불러 보지 않는다.
        expect(shareCalls(2026, '11012')).toBe(0);
    });

    it('연결 재무제표가 없는 회사는 별도(OFS)를 쓰고 직전 사업연도도 같은 구분으로만 읽는다', async () => {
        install({
            accMt: '12',
            statements: {
                '2026/11014/OFS': hpspH1Ofs.list,
                '2025/11011/OFS': hpspAnnualOfs.list,
            },
            shares: { '2026/11012': hpspShares.list },
        });
        const result = await getKrValuationInputs('403870.KQ', NOW);
        expect(result.kind === 'ok' && result.data.current.fsDiv).toBe('OFS');
        expect(result.kind === 'ok' && result.data.priorAnnual?.fsDiv).toBe(
            'OFS'
        );
        // 직전 연도는 별도만 부른다(연결을 섞으면 TTM이 두 기준의 합이 된다).
        expect(statementCalls(2025, '11011', 'CFS')).toBe(0);
        expect(statementCalls(2025, '11011', 'OFS')).toBe(1);
    });

    it('사업보고서가 최신이면 직전 사업연도를 따로 읽지 않는다', async () => {
        const result = await getKrValuationInputs(
            SYMBOL,
            new Date('2026-03-15T03:00:00Z')
        );
        // 2026-03-15: 사업보고서 공시 창(3/10~)이 열려 2025 사업보고서가 맨 앞이다.
        expect(result.kind === 'ok' && result.data.current.reportCode).toBe(
            '11011'
        );
        expect(result.kind === 'ok' && result.data.priorAnnual).toBeNull();
        expect(statementCalls(2024, '11011', 'CFS')).toBe(0);
    });

    it('직전 사업연도 보고서가 없으면(상장 1년 미만) priorAnnual은 null이고 나머지는 그대로다', async () => {
        install({
            ...WORLD,
            statements: { '2026/11014/CFS': samsungCardQ3.list },
        });
        const result = await getKrValuationInputs(SYMBOL, NOW);
        expect(result.kind === 'ok' && result.data.priorAnnual).toBeNull();
        expect(result.kind === 'ok' && result.data.current.reportCode).toBe(
            '11014'
        );
    });

    it('반기 표도 비어 있으면 전년 사업보고서 표를 쓴다', async () => {
        install({
            ...WORLD,
            shares: { '2025/11011': samsungCardH1Shares.list },
        });
        const result = await getKrValuationInputs(SYMBOL, NOW);
        expect(result.kind === 'ok' && result.data.shares?.issued).toBe(
            115_858_891
        );
        expect(shareCalls(2026, '11012')).toBe(1);
        expect(shareCalls(2025, '11011')).toBe(1);
    });

    it('세 후보 모두 보고서가 없으면 no_report다(후보당 연결·별도 한 번씩)', async () => {
        install({ ...WORLD, statements: {} });
        expect(await getKrValuationInputs(SYMBOL, NOW, 'background')).toEqual({
            kind: 'fallback',
            reason: 'no_report',
            transient: false,
        });
        expect(mocks.fetchFinancialStatementsAll).toHaveBeenCalledTimes(6);
    });

    it('12월 결산이 아닌 회사는 재무제표를 부르지 않고 non_december_fiscal_year다', async () => {
        install({ ...WORLD, accMt: '06' });
        expect(await getKrValuationInputs(SYMBOL, NOW)).toEqual({
            kind: 'fallback',
            reason: 'non_december_fiscal_year',
            transient: false,
        });
        expect(mocks.fetchFinancialStatementsAll).not.toHaveBeenCalled();
    });

    it('결산월을 알 수 없으면(기업개황 없음) dart_unavailable이다', async () => {
        install({ ...WORLD, accMt: null });
        expect(await getKrValuationInputs(SYMBOL, NOW)).toEqual({
            kind: 'fallback',
            reason: 'dart_unavailable',
            transient: false,
        });
    });

    it('DART 고유번호가 없는 종목은 not_covered다', async () => {
        mocks.getKrDartCorp.mockResolvedValue(null);
        expect(await getKrValuationInputs(SYMBOL, NOW)).toEqual({
            kind: 'fallback',
            reason: 'not_covered',
            transient: false,
        });
        expect(mocks.fetchCompanyInfo).not.toHaveBeenCalled();
    });

    it.each([
        ['키가 없을 때', () => mocks.isDartEnabled.mockReturnValue(false)],
        ['E2E에서', () => mocks.isE2E.mockReturnValue(true)],
    ])('%s DART를 부르지 않고 dart_unavailable이다', async (_, arrange) => {
        arrange();
        expect(await getKrValuationInputs(SYMBOL, NOW)).toEqual({
            kind: 'fallback',
            reason: 'dart_unavailable',
            transient: false,
        });
        expect(mocks.getKrDartCorp).not.toHaveBeenCalled();
        expect(mocks.fetchCompanyInfo).not.toHaveBeenCalled();
    });

    it('DART 할당량·네트워크 오류는 던지지 않고 로그 후 dart_unavailable이다', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        mocks.fetchFinancialStatementsAll.mockRejectedValue(
            new DartQuotaError('fnlttSinglAcntAll.json', 'quota exceeded (020)')
        );
        expect(await getKrValuationInputs(SYMBOL, NOW)).toEqual({
            kind: 'fallback',
            reason: 'dart_unavailable',
            transient: true,
        });
        const logged = warn.mock.calls
            .map(args => args.map(String).join(' '))
            .find(line => line.includes('[kr-valuation]'));
        // 사유 분류(`dartFatalReason`)와 오류 이름이 남는다. DART 클라이언트 오류는 URL(= 키)을 싣지 않는다.
        expect(logged).toContain('quota_exhausted');
        expect(logged).toContain('DartQuotaError');
        expect(logged).not.toContain('crtfc_key');
    });

    it('Next 동적 서버 오류(제어 흐름)는 삼키지 않고 다시 던진다', async () => {
        const control = Object.assign(new Error('Dynamic server usage: x'), {
            digest: 'DYNAMIC_SERVER_USAGE',
        });
        mocks.getKrDartCorp.mockRejectedValue(control);
        await expect(getKrValuationInputs(SYMBOL, NOW)).rejects.toBe(control);
    });
});

/** DART 호출 총수(기업 개황 + 재무제표 + 주식 표). */
const totalDartCalls = (): number =>
    mocks.fetchCompanyInfo.mock.calls.length +
    mocks.fetchFinancialStatementsAll.mock.calls.length +
    mocks.fetchStockTotalQuantity.mock.calls.length;

/**
 * 알테오젠(196170): 2026-07-16 무상증자 결정(+30%), 3분기 보고서가 나왔다. 보통주 53,586,343(반기 표) → 69,655,133(3분기 표·KRX 2026-09-30).
 * 3분기 자기 표가 비어 있는 경우는 실제 빈 3분기 표(삼성카드 응답, 모든 줄 `-`)로 만든다 — 알테오젠은 자기 표를 채워 내서 빈 응답이 없다.
 * 네이버(2026-11-26, 2026.09 기준) EPS 3,027원·BPS 7,746원이 독립 정답이다.
 */
const ALTEOGEN_SYMBOL = '196170.KQ';
const ALTEOGEN_WORLD: World = {
    accMt: '12',
    statements: {
        '2026/11014/CFS': alteogenQ3Cfs.list,
        '2025/11011/CFS': alteogenAnnual.list,
    },
    shares: {
        '2026/11012': alteogenH1Shares.list,
        '2026/11014': samsungCardQ3Shares.list,
    },
    krx: {
        '19617/20260930': krxItems(alteogenKrxRows, '20260930'),
        '19617/20260630': krxItems(alteogenKrxRows, '20260630'),
    },
};
const NAVER_EPS = 3_027;
const NAVER_BPS = 7_746;
const within = (actual: number | null, expected: number, pct: number) =>
    actual !== null && Math.abs(actual / expected - 1) <= pct / 100;

describe('getKrValuationInputs 주식수 (보고서 자기 표 → KRX 갱신 → 앞선 표)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.cacheTtls.clear();
        mocks.isE2E.mockReturnValue(false);
        mocks.isDartEnabled.mockReturnValue(true);
        mocks.getKrDartCorp.mockResolvedValue({
            corpCode: CORP,
            corpName: '알테오젠',
            viaCommonShare: false,
        });
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('알테오젠: 3분기 자기 표가 비면 반기 표를 기간 말(9/30) KRX 상장주식수로 갱신해 EPS·BPS가 네이버와 0.2% 안에서 맞는다', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        install(ALTEOGEN_WORLD);
        const result = await getKrValuationInputs(ALTEOGEN_SYMBOL, NOW);
        expect(result.kind).toBe('ok');
        if (result.kind !== 'ok') return;
        // 합계 53,993,136 + 보통주 Δ(69,655,133 − 53,586,343). 비상장 종류주식은 KRX에 없어 그대로다.
        expect(result.data.shares).toMatchObject({
            issued: 70_061_926,
            outstanding: 70_038_218,
            settledOn: '2026-09-30',
            source: 'dart_krx',
        });
        const valuation = computeKrValuation({
            ...result.data,
            price: { close: 169_600, date: '2026-11-25' },
        });
        expect(within(valuation?.epsTtm ?? null, NAVER_EPS, 0.2)).toBe(true);
        expect(within(valuation?.bps ?? null, NAVER_BPS, 0.2)).toBe(true);
        expect(valuation?.basis).toMatchObject({
            sharesSource: 'dart_krx',
            sharesAsOf: '2026-09-30',
        });
        // 갱신하지 않았다면(H1 표 그대로) EPS·BPS가 +30% 어긋난다 — 이 숫자가 고친 오차다.
        expect(
            within(
                (valuation?.epsTtm ?? 0) * (70_061_926 / 53_993_136),
                NAVER_EPS,
                1
            )
        ).toBe(false);
    });

    it('KRX 조회는 5자리 접두사·기간 말로 부르고 결과를 365일 캐시한다', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        install(ALTEOGEN_WORLD);
        await getKrValuationInputs(ALTEOGEN_SYMBOL, NOW);
        expect(krxCalls('19617', '20260930')).toBe(1);
        expect(
            mocks.fetchKrxListedItems.mock.calls.filter(
                ([prefix]) => prefix !== '19617'
            )
        ).toEqual([]);
        // 요청 경로의 요청 타임아웃(2.5초)을 그대로 넘긴다.
        expect(
            mocks.fetchKrxListedItems.mock.calls.find(
                ([, basDt]) => basDt === '20260930'
            )?.[2]
        ).toBe(2_500);
        expect(mocks.cacheTtls.get(key.krx('19617', '2026-09-30'))).toBe(
            365 * DAY
        );
        expect(key.krx('19617', '2026-09-30')).toBe(
            'krx:listed-shares:v1:19617:2026-09-30'
        );
    });

    it('KRX에 행이 없으면(빈 응답) 하루만 캐시하고 DART 표 그대로 쓴다', async () => {
        install({ ...ALTEOGEN_WORLD, krx: {} });
        const result = await getKrValuationInputs(ALTEOGEN_SYMBOL, NOW);
        expect(result.kind === 'ok' && result.data.shares).toMatchObject({
            issued: 53_993_136,
            source: 'dart',
            settledOn: '2026-06-30',
        });
        expect(mocks.cacheTtls.get(key.krx('19617', '2026-09-30'))).toBe(DAY);
    });

    it('보고서 자기 표가 채워져 있으면 그것을 쓰고 반기 표·KRX는 읽지 않는다(알테오젠 3분기)', async () => {
        install({
            ...ALTEOGEN_WORLD,
            shares: {
                ...ALTEOGEN_WORLD.shares,
                '2026/11014': alteogenQ3Shares.list,
            },
        });
        const result = await getKrValuationInputs(ALTEOGEN_SYMBOL, NOW);
        expect(result.kind === 'ok' && result.data.shares).toMatchObject({
            issued: 70_183_963,
            outstanding: 70_042_411,
            settledOn: '2026-09-30',
            source: 'dart',
        });
        expect(shareCalls(2026, '11012')).toBe(0);
        expect(mocks.fetchKrxListedItems).not.toHaveBeenCalled();
    });

    it('SK하이닉스 3분기: 자기 표(신주 17,790,000주가 자기주식으로 편입, 유통 불변)가 KRX Δ 규칙보다 우선한다', async () => {
        install({
            ...WORLD,
            shares: {
                '2026/11014': skHynixQ3Shares.list,
                // 자기 표를 건너뛰면 이 값이 쓰인다.
                '2026/11012': samsungCardH1Shares.list,
            },
            krx: {
                '02978/20260930': [],
            },
        });
        const result = await getKrValuationInputs(SYMBOL, NOW);
        expect(result.kind === 'ok' && result.data.shares).toMatchObject({
            issued: 730_492_365,
            treasury: 19_375_769,
            outstanding: 711_116_596,
            source: 'dart',
        });
        expect(mocks.fetchKrxListedItems).not.toHaveBeenCalled();
        expect(shareCalls(2026, '11012')).toBe(0);
    });

    it('KRX 조회가 실패하면 던지지 않고 DART 표만으로 계산하며 제공처 값으로 내려가지 않는다', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        install(ALTEOGEN_WORLD);
        mocks.fetchKrxListedItems.mockRejectedValue(
            new Error('[stockPriceInfo] HTTP 503')
        );
        const result = await getKrValuationInputs(ALTEOGEN_SYMBOL, NOW);
        expect(result.kind).toBe('ok');
        expect(result.kind === 'ok' && result.data.shares).toMatchObject({
            issued: 53_993_136,
            source: 'dart',
        });
        expect(
            warn.mock.calls.some(([message]) =>
                String(message).includes('KRX listed shares unavailable')
            )
        ).toBe(true);
        // 실패는 캐시에 굳지 않는다.
        expect(mocks.cacheTtls.has(key.krx('19617', '2026-09-30'))).toBe(false);
    });

    it('KRX 조회 중 Next 동적 서버 오류(제어 흐름)는 삼키지 않고 다시 던진다', async () => {
        install(ALTEOGEN_WORLD);
        const control = Object.assign(new Error('Dynamic server usage: x'), {
            digest: 'DYNAMIC_SERVER_USAGE',
        });
        mocks.fetchKrxListedItems.mockRejectedValue(control);
        await expect(getKrValuationInputs(ALTEOGEN_SYMBOL, NOW)).rejects.toBe(
            control
        );
    });

    it('data.go.kr 키가 없으면 KRX를 부르지 않고 DART 표 그대로다', async () => {
        install(ALTEOGEN_WORLD);
        mocks.hasDataGoKrCredentials.mockReturnValue(false);
        const result = await getKrValuationInputs(ALTEOGEN_SYMBOL, NOW);
        expect(result.kind === 'ok' && result.data.shares?.source).toBe('dart');
        expect(mocks.fetchKrxListedItems).not.toHaveBeenCalled();
    });

    it('갱신이 발행주식 총수를 20% 넘게 바꾸면 로그를 남기되 값은 적용한다', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        install(ALTEOGEN_WORLD);
        const result = await getKrValuationInputs(ALTEOGEN_SYMBOL, NOW);
        expect(result.kind === 'ok' && result.data.shares?.source).toBe(
            'dart_krx'
        );
        const logged = warn.mock.calls.find(([message]) =>
            String(message).includes('more than 20%')
        );
        expect(logged?.[1]).toBe(ALTEOGEN_SYMBOL);
        expect(logged?.[2]).toBe('29.8%');
    });

    it('20% 이내의 변화는 로그 없이 적용한다', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        install({
            ...ALTEOGEN_WORLD,
            krx: {
                '19617/20260930': krxItems(alteogenKrxRows, '20260930').map(
                    item => ({ ...item, listedShares: 55_000_000 })
                ),
            },
        });
        const result = await getKrValuationInputs(ALTEOGEN_SYMBOL, NOW);
        expect(result.kind === 'ok' && result.data.shares?.issued).toBe(
            53_993_136 + (55_000_000 - 53_586_343)
        );
        expect(
            warn.mock.calls.some(([message]) =>
                String(message).includes('more than 20%')
            )
        ).toBe(false);
    });

    it('시계: 3분기 공시 창(마감 11/14의 21일 전 = 10/24)이 열리기 전에는 반기가 최신이라 자기 표만 쓰고 KRX를 부르지 않는다', async () => {
        install({
            ...ALTEOGEN_WORLD,
            statements: {
                ...ALTEOGEN_WORLD.statements,
                '2026/11012/CFS': alteogenQ3Cfs.list,
            },
        });
        const before = await getKrValuationInputs(
            ALTEOGEN_SYMBOL,
            new Date('2026-10-23T03:00:00Z')
        );
        expect(before.kind === 'ok' && before.data.current.reportCode).toBe(
            '11012'
        );
        expect(before.kind === 'ok' && before.data.shares?.source).toBe('dart');
        expect(mocks.fetchKrxListedItems).not.toHaveBeenCalled();

        const after = await getKrValuationInputs(
            ALTEOGEN_SYMBOL,
            new Date('2026-10-24T03:00:00Z')
        );
        expect(after.kind === 'ok' && after.data.current.reportCode).toBe(
            '11014'
        );
        expect(after.kind === 'ok' && after.data.shares?.source).toBe(
            'dart_krx'
        );
        expect(krxCalls('19617', '20260930')).toBe(1);
    });

    const Q1_WORLD: World = {
        accMt: '12',
        statements: {
            '2026/11013/CFS': samsungCardQ1.list,
            '2025/11011/CFS': samsungCardAnnual.list,
        },
        // 실제 응답: 1분기 자기 표는 비었고(모든 줄 `-`), 사업보고서 표는 결산일 2025-12-31이다.
        shares: {
            '2026/11013': samsungCardQ1Shares.list,
            '2025/11011': samsungCardAnnualShares.list,
        },
        // 실제 KRX 2026-03-31 행: 상장주식수 115,858,891(= DART 표, 변화 없음).
        krx: { '02978/20260331': krxItems(samsungCardKrxRows, '20260331') },
    };
    const Q1_NOW = new Date('2026-05-12T03:00:00Z');

    it('1분기: 자기 표가 비면 전년 사업보고서 표를 3/31 KRX와 맞대고, 실제로 변화가 없으면(Δ=0) DART 표 그대로 쓴다', async () => {
        install(Q1_WORLD);
        const result = await getKrValuationInputs(SYMBOL, Q1_NOW);
        expect(result.kind === 'ok' && result.data.current.reportCode).toBe(
            '11013'
        );
        expect(krxCalls('02978', '20260331')).toBe(1);
        expect(result.kind === 'ok' && result.data.shares).toMatchObject({
            issued: 115_858_891,
            settledOn: '2025-12-31',
            source: 'dart',
        });
        expect(result.kind === 'ok' && result.transient).toBe(false);
    });

    it('1분기, 합성 값: KRX 상장주식수가 늘었다면(실제 행의 lstgStCnt만 116,500,000으로 바꾼 합성 데이터) 3/31 값으로 갱신한다', async () => {
        install({
            ...Q1_WORLD,
            krx: {
                '02978/20260331': krxItems(
                    samsungCardKrxRows.map(row => ({
                        ...row,
                        lstgStCnt: '116500000',
                    })),
                    '20260331'
                ),
            },
        });
        const result = await getKrValuationInputs(SYMBOL, Q1_NOW);
        expect(result.kind === 'ok' && result.data.shares).toMatchObject({
            issued: 116_500_000,
            settledOn: '2026-03-31',
            source: 'dart_krx',
        });
    });
});

describe('getKrValuationInputs 일시적 주식수·KRX 시한 (SERVER.md#SA-18)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.cacheTtls.clear();
        mocks.isE2E.mockReturnValue(false);
        mocks.isDartEnabled.mockReturnValue(true);
        mocks.getKrDartCorp.mockResolvedValue({
            corpCode: CORP,
            corpName: '알테오젠',
            viaCommonShare: false,
        });
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    const transientOf = (
        result: Awaited<ReturnType<typeof getKrValuationInputs>>
    ) => (result.kind === 'ok' ? result.transient : 'fallback');

    it.each([
        ['KRX 오류(HTTP·resultCode·타임아웃)', true],
        ['KRX 성공', false],
    ])('%s → transient=%s', async (_label, fails) => {
        install(ALTEOGEN_WORLD);
        if (fails) {
            mocks.fetchKrxListedItems.mockRejectedValue(
                new Error('[stockPriceInfo] HTTP 503')
            );
        }
        expect(
            transientOf(await getKrValuationInputs(ALTEOGEN_SYMBOL, NOW))
        ).toBe(fails);
    });

    it('data.go.kr 키 없음(설정)과 KRX의 빈 응답은 다시 물어도 같아 일시적이 아니다', async () => {
        install(ALTEOGEN_WORLD);
        mocks.hasDataGoKrCredentials.mockReturnValue(false);
        expect(
            transientOf(await getKrValuationInputs(ALTEOGEN_SYMBOL, NOW))
        ).toBe(false);
        install({ ...ALTEOGEN_WORLD, krx: {} });
        expect(
            transientOf(await getKrValuationInputs(ALTEOGEN_SYMBOL, NOW))
        ).toBe(false);
    });

    it('DART 단계에서 시한을 다 쓰면 KRX를 부르지 않고 일시적으로 표시한다', async () => {
        vi.useFakeTimers();
        install(ALTEOGEN_WORLD);
        const startMs = Date.now();
        // 시계만 5초 건너뛴다(타이머는 발화시키지 않는다) — 마지막 DART 호출(반기 표)을 마치면 시한이 지났다.
        mocks.fetchStockTotalQuantity.mockImplementation(
            async (_corp: string, year: number, report: string) => {
                if (report === '11012') vi.setSystemTime(startMs + 5_000);
                return ALTEOGEN_WORLD.shares[`${year}/${report}`] ?? null;
            }
        );
        const result = await getKrValuationInputs(ALTEOGEN_SYMBOL, NOW);
        expect(result.kind === 'ok' && result.data.shares?.source).toBe('dart');
        expect(transientOf(result)).toBe(true);
        expect(mocks.fetchKrxListedItems).not.toHaveBeenCalled();
    });

    it('KRX 요청 타임아웃은 남은 시한으로 자른다(바깥 시한이 먼저 터지지 않게)', async () => {
        vi.useFakeTimers();
        install(ALTEOGEN_WORLD);
        const startMs = Date.now();
        mocks.fetchStockTotalQuantity.mockImplementation(
            async (_corp: string, year: number, report: string) => {
                if (report === '11012') vi.setSystemTime(startMs + 4_000);
                return ALTEOGEN_WORLD.shares[`${year}/${report}`] ?? null;
            }
        );
        await getKrValuationInputs(ALTEOGEN_SYMBOL, NOW);
        // 요청 경로: 요청 타임아웃 2.5초, 전체 시한 5초 중 4초를 썼으니 남은 1초다.
        expect(
            mocks.fetchKrxListedItems.mock.calls.find(
                ([, basDt]) => basDt === '20260930'
            )?.[2]
        ).toBe(1_000);
    });

    it('남은 시한이 요청 타임아웃보다 길면 요청 타임아웃을 쓴다', async () => {
        install(ALTEOGEN_WORLD);
        await getKrValuationInputs(ALTEOGEN_SYMBOL, NOW);
        expect(
            mocks.fetchKrxListedItems.mock.calls.find(
                ([, basDt]) => basDt === '20260930'
            )?.[2]
        ).toBe(2_500);
    });

    it('이미 공시된 보고서 자기 표가 비었다는 사실은 30일, 앞선 표를 못 찾은 사실은 7일 캐시한다', async () => {
        install({
            ...ALTEOGEN_WORLD,
            shares: { '2026/11014': samsungCardQ3Shares.list },
        });
        await getKrValuationInputs(ALTEOGEN_SYMBOL, NOW);
        expect(mocks.cacheTtls.get(key.shares(2026, '11014'))).toBe(FOUND_TTL);
        expect(mocks.cacheTtls.get(key.shares(2026, '11012'))).toBe(
            MISSING_AFTER_DEADLINE_TTL
        );
        expect(mocks.cacheTtls.get(key.shares(2025, '11011'))).toBe(
            MISSING_AFTER_DEADLINE_TTL
        );
    });
});

describe('getKrValuationInputs 요청 경로 예산 (SERVER.md#SA-14, CC-1)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.cacheTtls.clear();
        mocks.isE2E.mockReturnValue(false);
        mocks.isDartEnabled.mockReturnValue(true);
        mocks.getKrDartCorp.mockResolvedValue({
            corpCode: CORP,
            corpName: '삼성카드',
            viaCommonShare: false,
        });
        install(WORLD);
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('요청 경로는 요청 하나 2.5초·재시도 없음·크론 몫 6,000호출 예약 옵션을 모든 DART 호출에 넘긴다', async () => {
        await getKrValuationInputs(SYMBOL, NOW);
        const request = { timeoutMs: 2_500, maxRetries: 0, reserve: 6_000 };
        expect(mocks.fetchCompanyInfo).toHaveBeenCalledWith(CORP, request);
        expect(mocks.fetchFinancialStatementsAll).toHaveBeenCalledWith(
            CORP,
            2026,
            '11014',
            'CFS',
            request
        );
        expect(mocks.fetchStockTotalQuantity).toHaveBeenCalledWith(
            CORP,
            2026,
            '11012',
            request
        );
    });

    it('배경 경로(프리웜)는 크론 기본 옵션(30초·재시도 1회)을 쓰되 예약은 그대로 지킨다', async () => {
        await getKrValuationInputs(SYMBOL, NOW, 'background');
        expect(mocks.fetchCompanyInfo).toHaveBeenCalledWith(CORP, {
            timeoutMs: 30_000,
            maxRetries: 1,
            reserve: 6_000,
        });
    });

    it('종목당 호출은 7회를 넘지 않는다 — 넘으면 일시적 제공처 대체다', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        // 최신 두 후보가 아직 없다: 개황 1 + (연결·별도)×2 + 세 번째 후보 연결 1 + 직전 연도 1 + 주식 표(자기 표) 1 → 8번째 호출에서 막힌다.
        install({
            ...WORLD,
            statements: {
                '2026/11013/CFS': samsungCardQ1.list,
                '2025/11011/CFS': samsungCardAnnual.list,
            },
        });
        expect(await getKrValuationInputs(SYMBOL, NOW)).toEqual({
            kind: 'fallback',
            reason: 'dart_unavailable',
            transient: true,
        });
        expect(totalDartCalls()).toBe(7);
        expect(
            warn.mock.calls.some(([message]) =>
                String(message).includes('[kr-valuation]')
            )
        ).toBe(true);
    });

    it('느린 DART는 전체 시한(5초) 안에 제공처 값으로 내려간다', async () => {
        vi.useFakeTimers();
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        // 응답이 시한(5초)보다 한참 늦게 온다 — 실제 클라이언트는 요청 타임아웃으로 결국 끝나므로 슬롯도 풀린다.
        mocks.fetchFinancialStatementsAll.mockImplementation(
            () =>
                new Promise(resolve => setTimeout(() => resolve(null), 60_000))
        );
        const pending = getKrValuationInputs(SYMBOL, NOW);
        await vi.advanceTimersByTimeAsync(4_999);
        let settled = false;
        void pending.then(() => {
            settled = true;
        });
        await vi.advanceTimersByTimeAsync(0);
        expect(settled).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
        expect(await pending).toEqual({
            kind: 'fallback',
            reason: 'dart_unavailable',
            transient: true,
        });
        await vi.advanceTimersByTimeAsync(60_000);
    });

    it('시한이 지난 뒤에는 남은 단계가 DART를 더 부르지 않는다', async () => {
        vi.useFakeTimers();
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        // 기업 개황이 6초 걸려 시한(5초)을 넘긴다 — 늦게 풀려도 재무제표 호출은 시작되지 않는다.
        mocks.fetchCompanyInfo.mockImplementation(
            () =>
                new Promise(resolve =>
                    setTimeout(() => resolve({ acc_mt: '12' }), 6_000)
                )
        );
        const pending = getKrValuationInputs(SYMBOL, NOW);
        await vi.advanceTimersByTimeAsync(10_000);
        expect(await pending).toMatchObject({ transient: true });
        expect(mocks.fetchFinancialStatementsAll).not.toHaveBeenCalled();
    });

    it('줄에서 기다리는 동안 시한이 지난 호출은 DB·DART를 건드리지 않고 슬롯을 다음 호출에 돌려준다', async () => {
        vi.useFakeTimers();
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const holders: (() => void)[] = [];
        mocks.fetchCompanyInfo.mockImplementationOnce(
            () =>
                new Promise(resolve =>
                    holders.push(() => resolve({ acc_mt: '12' }))
                )
        );
        mocks.fetchCompanyInfo.mockImplementationOnce(
            () =>
                new Promise(resolve =>
                    holders.push(() => resolve({ acc_mt: '12' }))
                )
        );
        mocks.fetchCompanyInfo.mockImplementationOnce(
            () =>
                new Promise(resolve =>
                    holders.push(() => resolve({ acc_mt: '12' }))
                )
        );
        mocks.fetchCompanyInfo.mockImplementationOnce(
            () =>
                new Promise(resolve =>
                    holders.push(() => resolve({ acc_mt: '12' }))
                )
        );
        const running = Array.from({ length: 4 }, () =>
            getKrValuationInputs(SYMBOL, NOW)
        );
        await vi.advanceTimersByTimeAsync(0);
        expect(mocks.getKrDartCorp).toHaveBeenCalledTimes(4);
        // 다섯 번째는 슬롯이 없어 줄을 선다. 5초 시한이 줄에서 지난다.
        const queued = getKrValuationInputs(SYMBOL, NOW);
        await vi.advanceTimersByTimeAsync(5_000);
        expect(await queued).toMatchObject({ transient: true });
        // 슬롯이 나면 줄의 호출이 들어오지만 시한이 지났으므로 아무것도 읽지 않고 슬롯을 돌려준다.
        holders[0]?.();
        await vi.advanceTimersByTimeAsync(0);
        expect(mocks.getKrDartCorp).toHaveBeenCalledTimes(4);
        // 돌려준 슬롯을 다음 호출이 쓴다.
        mocks.fetchCompanyInfo.mockResolvedValue({ acc_mt: '12' });
        const next = getKrValuationInputs(SYMBOL, NOW);
        await vi.advanceTimersByTimeAsync(0);
        expect(mocks.getKrDartCorp).toHaveBeenCalledTimes(5);
        holders.forEach(release => release());
        await vi.advanceTimersByTimeAsync(0);
        await Promise.all([...running, next]);
    });

    it('동시에 DART를 읽는 종목은 4개까지이고 나머지는 슬롯이 나길 기다린다', async () => {
        const releases: (() => void)[] = [];
        mocks.fetchCompanyInfo.mockImplementation(
            () =>
                new Promise(resolve => {
                    releases.push(() => resolve({ acc_mt: '12' }));
                })
        );
        const loads = Array.from({ length: 5 }, () =>
            getKrValuationInputs(SYMBOL, NOW, 'background')
        );
        await vi.waitFor(() =>
            expect(mocks.fetchCompanyInfo).toHaveBeenCalledTimes(4)
        );
        // 다섯 번째는 아직 시작하지 않았다.
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(mocks.fetchCompanyInfo).toHaveBeenCalledTimes(4);
        // 하나가 끝나면 다섯 번째가 들어온다.
        releases[0]?.();
        await vi.waitFor(() =>
            expect(mocks.fetchCompanyInfo).toHaveBeenCalledTimes(5)
        );
        releases.forEach(release => release());
        await vi.waitFor(() => expect(releases).toHaveLength(5));
        releases.forEach(release => release());
        expect((await Promise.all(loads)).every(l => l.kind === 'ok')).toBe(
            true
        );
    });
});
