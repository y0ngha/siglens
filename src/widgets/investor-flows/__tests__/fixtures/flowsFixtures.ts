import {
    evaluateInvestorFlows,
    type EvaluateInvestorFlowsOptions,
    type FailsToDeliverPoint,
    type InsiderTransaction,
    type InstitutionalOptionsQuarter,
    type OfferingFiling,
    type ProposedSale,
    type SqueezeRiskContext,
    type ThresholdListStatus,
    type InstitutionalHolderChange,
    type InstitutionalQuarter,
    type InvestorFlowsScorecard,
    type InvestorFlowsSnapshot,
    type LargeHolderFiling,
    type ShortInterestPoint,
    type ShortVolumePoint,
} from '@y0ngha/siglens-core';
import type {
    DartInsiderReportRecord,
    DartMajorHoldingRecord,
    DartTradingPlanRecord,
} from '@/entities/investor-flows/api/investorFlowsDartRepository';
import { assembleKrInvestorFlowsSnapshot } from '@/entities/investor-flows/lib/krInvestorFlowsSnapshot';

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
    includeFinraData = true,
    options: Omit<
        EvaluateInvestorFlowsOptions,
        'asOf' | 'includeFinraData'
    > = {}
): InvestorFlowsScorecard {
    return evaluateInvestorFlows(snapshot, {
        asOf: FLOWS_AS_OF,
        includeFinraData,
        ...options,
    });
}

/** FTD — 기준일 전 2~7주의 실패일 몇 개(최근 2주는 SEC 게시 지연으로 비어 있다). */
export function makeFailsToDeliver(qty = 1_400_000): FailsToDeliverPoint[] {
    return [
        '2026-08-28',
        '2026-09-10',
        '2026-09-18',
        '2026-09-24',
        '2026-09-30',
    ].map((settlementDate, index) => ({
        settlementDate,
        failsQty: index === 3 ? qty * 3 : qty + index * 120_000,
        price: index === 1 ? null : 205 + index,
    }));
}

export function makeProposedSale(
    overrides: Partial<ProposedSale> = {}
): ProposedSale {
    return {
        filingDate: '2026-10-12',
        filer: 'Fixture Officer F',
        relationships: ['Officer'],
        shares: 30_000,
        valueUsd: 6_360_000,
        approxSaleDate: '2026-10-13',
        planAdoptionDate: '2026-06-01',
        url: 'https://www.sec.gov/Archives/edgar/data/0/fixture-144-index.htm',
        ...overrides,
    };
}

export function makeOffering(
    overrides: Partial<OfferingFiling> = {}
): OfferingFiling {
    return {
        filingDate: '2026-10-04',
        form: '424B5',
        kind: 'atm',
        url: 'https://www.sec.gov/Archives/edgar/data/0/fixture-424b5-index.htm',
        ...overrides,
    };
}

export function makeOptionsQuarter(
    overrides: Partial<InstitutionalOptionsQuarter> = {}
): InstitutionalOptionsQuarter {
    return {
        period: '2026-06-30',
        complete: true,
        putHolders: 640,
        putShares: 280_000_000,
        putValueUsd: 58_800_000_000,
        callHolders: 700,
        callShares: 190_000_000,
        callValueUsd: 39_900_000_000,
        ...overrides,
    };
}

export function makeThresholdList(
    overrides: Partial<ThresholdListStatus> = {}
): ThresholdListStatus {
    return {
        listed: true,
        consecutiveDays: 15,
        firstListedDate: '2026-09-24',
        markets: ['Nasdaq'],
        asOf: '2026-10-15',
        ...overrides,
    };
}

/** 수급 확장 원천(13F 옵션·Form 144·증자 공시·FTD·과열 목록)을 모두 채운 스냅샷. */
export function makeExpandedSnapshot(
    overrides: Partial<InvestorFlowsSnapshot> = {}
): InvestorFlowsSnapshot {
    const base = makeSnapshot();
    return makeSnapshot({
        institutional: {
            ...base.institutional,
            options: [
                makeOptionsQuarter({
                    period: '2026-03-31',
                    putValueUsd: 30_000_000_000,
                    callValueUsd: 40_000_000_000,
                }),
                makeOptionsQuarter(),
            ],
        },
        failsToDeliver: makeFailsToDeliver(),
        proposedSales: [
            makeProposedSale(),
            makeProposedSale({
                filingDate: '2026-09-28',
                filer: 'Fixture Director C',
                relationships: ['Director'],
                planAdoptionDate: null,
                shares: 5_000,
                valueUsd: 1_030_000,
            }),
        ],
        offerings: [
            makeOffering(),
            makeOffering({
                filingDate: '2026-07-10',
                form: 'S-3ASR',
                kind: 'shelf',
                url: 'https://www.sec.gov/Archives/edgar/data/0/fixture-s3-index.htm',
            }),
        ],
        thresholdList: makeThresholdList({
            listed: false,
            consecutiveDays: 0,
            firstListedDate: null,
            markets: [],
        }),
        ...overrides,
    });
}

/** 숏스퀴즈 가격 입력 — 기준일 전 30세션, 최근 20세션은 주가가 오르고 최근 5세션 거래량이 늘어난다. */
export function makeSqueezeContext(): SqueezeRiskContext {
    const sessions: string[] = [];
    let cursor = new Date(`${FLOWS_AS_OF}T00:00:00Z`);
    while (sessions.length < 30) {
        cursor = new Date(cursor.getTime() - 86_400_000);
        const weekday = cursor.getUTCDay();
        if (weekday !== 0 && weekday !== 6)
            sessions.unshift(cursor.toISOString().slice(0, 10));
    }
    return {
        dailyBars: sessions.map((date, index) => ({
            date,
            close: 100 + Math.max(0, index - 9) * 2,
            volume: index >= 25 ? 90_000_000 : 30_000_000,
        })),
    };
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

// ── 한국(DART) ──────────────────────────────────────────────────────────────────────────────────────────────
// 손으로 core 타입을 만들지 않고 저장소 행 → `assembleKrInvestorFlowsSnapshot`(실제 매핑)을 거쳐 만든다.

export function makeKrMajorHoldingRecord(
    over: Partial<DartMajorHoldingRecord> = {}
): DartMajorHoldingRecord {
    return {
        rceptNo: '20261014000124',
        receiptDate: '2026-10-14',
        reporter: '픽스처자산운용',
        reportForm: 'abbreviated',
        shares: 301_500_000,
        sharesChange: 301_500_000,
        ratioPct: 5.05,
        ratioChangePct: 5.05,
        reason: '신규 보고',
        ...over,
    };
}

export function makeKrInsiderRecord(
    over: Partial<DartInsiderReportRecord> = {}
): DartInsiderReportRecord {
    return {
        rceptNo: '20261013000457',
        receiptDate: '2026-10-13',
        reporter: '최임원',
        position: '부사장',
        registered: false,
        majorShareholder: null,
        shares: 8_000,
        sharesChange: -2_000,
        ratioPct: 0,
        ratioChangePct: 0,
        ...over,
    };
}

export function makeKrTradingPlanRecord(
    over: Partial<DartTradingPlanRecord> = {}
): DartTradingPlanRecord {
    return {
        rceptNo: '20261012000789',
        receiptDate: '2026-10-12',
        reporter: '이임원',
        title: '임원ㆍ주요주주특정증권등거래계획보고서',
        ...over,
    };
}

/** 대량보유 2건(5% 신규 진입 포함)·소유보고 2건·거래계획 1건의 한국 스냅샷. */
export function makeKrSnapshot(
    over: Partial<{
        majorHoldings: DartMajorHoldingRecord[];
        insiderReports: DartInsiderReportRecord[];
        tradingPlans: DartTradingPlanRecord[];
    }> = {}
): InvestorFlowsSnapshot {
    const { snapshot } = assembleKrInvestorFlowsSnapshot({
        asOf: FLOWS_AS_OF,
        majorHoldings: over.majorHoldings ?? [
            makeKrMajorHoldingRecord(),
            makeKrMajorHoldingRecord({
                rceptNo: '20261010000001',
                receiptDate: '2026-10-10',
                reporter: '국민연금공단',
                reportForm: 'detailed',
                shares: 432_154_213,
                sharesChange: -5_120_000,
                ratioPct: 7.24,
                ratioChangePct: -0.09,
                reason: '보유주식등의 수 변동',
            }),
        ],
        insiderReports: over.insiderReports ?? [
            makeKrInsiderRecord(),
            makeKrInsiderRecord({
                rceptNo: '20261013000458',
                reporter: '박주주',
                position: null,
                registered: null,
                majorShareholder: '10%이상주주',
                shares: 650_000_000,
                sharesChange: 18_000_000,
                ratioPct: 10.89,
                ratioChangePct: 0.3,
            }),
        ],
        tradingPlans: over.tradingPlans ?? [makeKrTradingPlanRecord()],
        sharesOutstanding: null,
    });
    if (snapshot === null) throw new Error('makeKrSnapshot: empty fixture');
    return snapshot;
}
