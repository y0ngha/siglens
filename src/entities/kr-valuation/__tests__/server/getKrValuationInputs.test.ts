const mocks = vi.hoisted(() => ({
    fetchFinancialStatementsAll: vi.fn(),
    fetchStockTotalQuantity: vi.fn(),
    fetchCompanyInfo: vi.fn(),
    isDartEnabled: vi.fn(),
    getKrDartCorp: vi.fn(),
    isE2E: vi.fn(),
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
        `dart:stock-totqy:v1:${CORP}:${year}:${report}`,
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
}

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
        // 3분기 보고서는 주식 표가 비어 있어(`-`) 같은 해 반기 표를 쓴다.
        expect(result.data.shares).toMatchObject({
            issued: 115_858_891,
            outstanding: 106_710_695,
            settledOn: '2026-06-30',
        });
        expect(shareCalls(2026, '11014')).toBe(0);
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
            'dart:stock-totqy:v1:00126292:2026:11012'
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

    it('종목당 호출은 6회를 넘지 않는다 — 넘으면 일시적 제공처 대체다', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        // 최신 두 후보가 아직 없다: 개황 1 + (연결·별도)×2 + 세 번째 후보 연결 1 + 직전 연도 1 → 7번째 호출에서 막힌다.
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
        expect(totalDartCalls()).toBe(6);
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
