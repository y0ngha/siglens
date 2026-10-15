import {
    evaluateInvestorFlows,
    type InsiderTransaction,
    type InstitutionalHolderChange,
    type InstitutionalQuarter,
    type InvestorFlowsScorecard,
    type InvestorFlowsSnapshot,
    type LargeHolderFiling,
    type ShortInterestPoint,
    type ShortVolumePoint,
} from '@y0ngha/siglens-core';

/** 테스트 기준일(고정) — 90일 창·분기 완결 판정이 시간에 흔들리지 않게 모든 날짜를 이 날 기준으로 적는다. */
export const FLOWS_AS_OF = '2026-10-16';

export function makeQuarter(
    overrides: Partial<InstitutionalQuarter> = {}
): InstitutionalQuarter {
    return {
        period: '2026-06-30',
        complete: true,
        holders: 5240,
        shares: 9_300_000_000,
        valueUsd: 1_953_000_000_000,
        newHolders: 310,
        increased: 2480,
        decreased: 1930,
        exited: 180,
        netShareChange: 142_000_000,
        ...overrides,
    };
}

export function makeHolder(
    overrides: Partial<InstitutionalHolderChange> = {}
): InstitutionalHolderChange {
    return {
        filerName: 'Fixture Index Advisors',
        cik: '0000000001',
        shares: 1_300_000_000,
        valueUsd: 273_000_000_000,
        prevShares: 1_280_000_000,
        change: 'increased',
        ...overrides,
    };
}

export function makeTransaction(
    overrides: Partial<InsiderTransaction> = {}
): InsiderTransaction {
    return {
        date: '2026-10-10',
        filingDate: '2026-10-12',
        name: 'Fixture Director A',
        role: 'director',
        type: 'buy',
        shares: 4000,
        price: 210,
        value: 840_000,
        sharesOwnedAfter: 80_000,
        url: 'https://www.sec.gov/Archives/edgar/data/0/fixture-index.htm',
        ...overrides,
    };
}

export function makeLargeHolder(
    overrides: Partial<LargeHolderFiling> = {}
): LargeHolderFiling {
    return {
        filingDate: '2026-09-01',
        filer: 'Fixture Activist Partners',
        form: 'SC 13D/A',
        percentOfClass: 5.4,
        shares: 800_000_000,
        url: 'https://www.sec.gov/Archives/edgar/data/0/fixture-13d-index.htm',
        ...overrides,
    };
}

export function makeShortInterest(count = 4): ShortInterestPoint[] {
    return Array.from({ length: count }, (_, index) => ({
        settlementDate: `2026-0${6 + index}-15`,
        shortQty: 110_000_000 + index * 6_000_000,
        avgDailyVolume: 52_000_000,
        daysToCover: 1.9 + index * 0.1,
    }));
}

/** 거래일 `count`개(2026-10-15부터 거꾸로, 주말 제외). 마지막 5거래일은 비중이 급등한다. */
export function makeShortVolume(count = 70): ShortVolumePoint[] {
    const points: ShortVolumePoint[] = [];
    let cursor = new Date('2026-10-16T00:00:00Z');
    while (points.length < count) {
        cursor = new Date(cursor.getTime() - 86_400_000);
        const weekday = cursor.getUTCDay();
        if (weekday === 0 || weekday === 6) continue;
        const ratio =
            points.length < 5 ? 0.62 : 0.44 + (points.length % 7) * 0.004;
        points.unshift({
            date: cursor.toISOString().slice(0, 10),
            shortVolume: Math.round(30_000_000 * ratio),
            totalVolume: 30_000_000,
        });
    }
    return points;
}

/** 기본 스냅샷: 완결 분기 3개 + 진행 분기 1개, 클러스터 매수 4건, 13D 1건, FINRA 데이터 있음. */
export function makeSnapshot(
    overrides: Partial<InvestorFlowsSnapshot> = {}
): InvestorFlowsSnapshot {
    return {
        asOf: `${FLOWS_AS_OF}T03:00:00.000Z`,
        sharesOutstanding: 15_000_000_000,
        floatShares: 14_900_000_000,
        institutional: {
            quarters: [
                makeQuarter({
                    period: '2025-12-31',
                    holders: 5110,
                    newHolders: 300,
                    increased: 2420,
                    decreased: 1980,
                    exited: 170,
                    netShareChange: 95_000_000,
                }),
                makeQuarter({
                    period: '2026-03-31',
                    holders: 5160,
                    newHolders: 240,
                    increased: 2210,
                    decreased: 2250,
                    exited: 210,
                    netShareChange: -48_000_000,
                }),
                makeQuarter({ period: '2026-06-30' }),
                makeQuarter({
                    period: '2026-09-30',
                    complete: false,
                    holders: 1480,
                    newHolders: 90,
                    increased: 700,
                    decreased: 560,
                    exited: 40,
                    netShareChange: 38_000_000,
                }),
            ],
            topHolders: [
                makeHolder(),
                makeHolder({
                    filerName: 'Fixture Asset Management',
                    cik: '0000000002',
                    shares: 1_050_000_000,
                    prevShares: 1_090_000_000,
                    change: 'decreased',
                }),
                makeHolder({
                    filerName: 'Fixture Global Partners',
                    cik: '0000000004',
                    shares: 410_000_000,
                    prevShares: null,
                    change: 'new',
                }),
                makeHolder({
                    filerName: 'Fixture Hedge Fund LP',
                    cik: '0000000006',
                    shares: 0,
                    valueUsd: 0,
                    prevShares: 220_000_000,
                    change: 'exited',
                }),
            ],
            topHoldersPeriod: '2026-06-30',
        },
        insider: {
            transactions: [
                makeTransaction({
                    date: '2026-10-10',
                    name: 'Fixture Director A',
                }),
                makeTransaction({
                    date: '2026-10-07',
                    name: 'Fixture Officer B',
                    role: 'officer: CFO',
                }),
                makeTransaction({
                    date: '2026-10-04',
                    name: 'Fixture Director C',
                }),
                makeTransaction({
                    date: '2026-10-01',
                    name: 'Fixture Officer D',
                    role: 'officer: COO',
                }),
                makeTransaction({
                    date: '2026-09-25',
                    name: 'Fixture Officer E',
                    role: 'officer: SVP',
                    type: 'sell',
                    shares: 12_000,
                    price: 211,
                    value: 2_532_000,
                }),
                makeTransaction({
                    date: '2026-09-02',
                    name: 'Fixture Officer G',
                    type: 'other',
                    value: null,
                    price: null,
                }),
            ],
        },
        largeHolders: [makeLargeHolder()],
        shortInterest: makeShortInterest(),
        shortVolume: makeShortVolume(),
        ...overrides,
    };
}

export function evaluate(
    snapshot: InvestorFlowsSnapshot,
    includeFinraData = true
): InvestorFlowsScorecard {
    return evaluateInvestorFlows(snapshot, {
        asOf: FLOWS_AS_OF,
        includeFinraData,
    });
}

/** 어떤 구간에도 데이터가 없는 스냅샷(점수표는 전 축 `insufficient`). */
export function makeEmptySnapshot(): InvestorFlowsSnapshot {
    return makeSnapshot({
        institutional: { quarters: [], topHolders: [], topHoldersPeriod: null },
        insider: { transactions: [] },
        largeHolders: [],
        shortInterest: [],
        shortVolume: [],
    });
}
