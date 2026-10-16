import type {
    InsiderTransaction,
    InstitutionalHolderChange,
    InstitutionalQuarter,
    InvestorFlowsDataProvider,
    InvestorFlowsSnapshot,
    LargeHolderFiling,
    ShortInterestPoint,
    ShortVolumePoint,
} from '@y0ngha/siglens-core';
import { ISO_DATE_LENGTH, MS_PER_DAY } from '@/shared/config/time';
import {
    addDays,
    latestQuarterEndOnOrBefore,
    previousQuarterEnd,
} from '../lib/investorFlowsDates';

/**
 * E2E 전용 `InvestorFlowsDataProvider`: DB·FMP·FINRA 대신 결정적인 합성 스냅샷을 돌려준다.
 * `E2E_TEST=1`에서만 `getInvestorFlowsDataProvider`가 고른다. 환경 변수를 읽지 않고 네트워크도 쓰지 않는다
 * (FINRA 플래그만 생성자 인자로 받는다 — 진짜 구현과 같은 규칙: 꺼지면 공매도 필드는 `null`).
 *
 * 날짜는 **오늘 기준 상대값**이다. 고정 날짜로 두면 어느 날부터 90일 창·분기 완결 판정이 달라져 스펙이
 * 시간에 따라 깨진다. 숫자는 고정이라 단언은 숫자와 라벨로 한다.
 *
 * - 기본 심볼: 직전 완결 분기는 기관 순매수(IN), 진행 중인 분기 하나(부분 집계), 내부자 클러스터 매수,
 *   13D·13G 각 1건, 공매도 잔고·일별 공매도 비중이 모두 있는 종목.
 * - `EMPTYX`: 수급 데이터가 전혀 없는 종목(`null`) — 빈 상태 UI 검증.
 * - `SQUEEZX`: 공매도 잔고가 유통주식의 약 19.5%(2.9e9주 / 1.49e10주), 상환일수 7일로 오르는 종목 — 숏스퀴즈 경고 배지 검증.
 */

const SHARES_OUTSTANDING = 15_000_000_000;
const FLOAT_SHARES = 14_900_000_000;

function isoDay(date: Date): string {
    return date.toISOString().slice(0, ISO_DATE_LENGTH);
}

function quarterEnds(today: string, count: number): string[] {
    const latest = latestQuarterEndOnOrBefore(today);
    // `k`분기 전 분기말(접기 `k`번) — 오래된 → 최신 순으로 돌려준다.
    return Array.from({ length: count }, (_, k) =>
        Array.from({ length: k }).reduce<string>(
            period => previousQuarterEnd(period),
            latest
        )
    ).reverse();
}

function buildQuarters(today: string): InstitutionalQuarter[] {
    const periods = quarterEnds(today, 5);
    // 오래된 분기 → 최신 분기. 마지막 완결 분기는 순매수(IN), 그 앞은 순매도(OUT)가 섞이게 한다.
    const rows = [
        { holders: 5020, shares: 9.1e9, netShareChange: -61_000_000 },
        { holders: 5110, shares: 9.2e9, netShareChange: 95_000_000 },
        { holders: 5160, shares: 9.15e9, netShareChange: -48_000_000 },
        { holders: 5240, shares: 9.3e9, netShareChange: 142_000_000 },
        { holders: 1480, shares: 2.1e9, netShareChange: 38_000_000 },
    ];
    const splits = [
        { newHolders: 260, increased: 2310, decreased: 2100, exited: 190 },
        { newHolders: 300, increased: 2420, decreased: 1980, exited: 170 },
        { newHolders: 240, increased: 2210, decreased: 2250, exited: 210 },
        { newHolders: 310, increased: 2480, decreased: 1930, exited: 180 },
        { newHolders: 90, increased: 700, decreased: 560, exited: 40 },
    ];
    return periods.map((period, index) => ({
        period,
        // 마지막 분기는 항상 "진행 중(부분 집계)"으로 고정한다. 실제 마감 판정(`isPeriodComplete`)을 쓰면 분기말 +50일
        // 이후 구간에는 진행 분기가 사라져 "부분 집계" UI를 검증하는 스펙이 시간에 따라 깨진다.
        complete: index < periods.length - 1,
        holders: rows[index].holders,
        shares: rows[index].shares,
        valueUsd: rows[index].shares * 210,
        newHolders: splits[index].newHolders,
        increased: splits[index].increased,
        decreased: splits[index].decreased,
        exited: splits[index].exited,
        netShareChange: rows[index].netShareChange,
    }));
}

const TOP_HOLDER_ROWS: ReadonlyArray<
    Pick<
        InstitutionalHolderChange,
        'filerName' | 'cik' | 'shares' | 'prevShares' | 'change'
    >
> = [
    {
        filerName: 'Fixture Index Advisors',
        cik: '0000000001',
        shares: 1_300_000_000,
        prevShares: 1_280_000_000,
        change: 'increased',
    },
    {
        filerName: 'Fixture Asset Management',
        cik: '0000000002',
        shares: 1_050_000_000,
        prevShares: 1_090_000_000,
        change: 'decreased',
    },
    {
        filerName: 'Fixture Capital Group',
        cik: '0000000003',
        shares: 590_000_000,
        prevShares: 590_000_000,
        change: 'unchanged',
    },
    {
        filerName: 'Fixture Global Partners',
        cik: '0000000004',
        shares: 410_000_000,
        prevShares: null,
        change: 'new',
    },
    {
        filerName: 'Fixture Pension Fund',
        cik: '0000000005',
        shares: 360_000_000,
        prevShares: 330_000_000,
        change: 'increased',
    },
    {
        filerName: 'Fixture Hedge Fund LP',
        cik: '0000000006',
        shares: 0,
        prevShares: 220_000_000,
        change: 'exited',
    },
];

function buildTopHolders(): InstitutionalHolderChange[] {
    return TOP_HOLDER_ROWS.map(row => ({
        ...row,
        valueUsd: row.shares * 210,
    }));
}

function buildInsiderTransactions(today: string): InsiderTransaction[] {
    const make = (
        daysAgo: number,
        name: string,
        role: string,
        type: InsiderTransaction['type'],
        shares: number,
        price: number
    ): InsiderTransaction => ({
        date: addDays(today, -daysAgo),
        filingDate: addDays(today, -daysAgo + 2),
        name,
        role,
        type,
        shares,
        price,
        value: shares * price,
        sharesOwnedAfter: shares * 20,
        url: `https://www.sec.gov/Archives/edgar/data/0/fixture-${daysAgo}-index.htm`,
    });
    return [
        make(6, 'Fixture Director A', 'director', 'buy', 4_000, 210),
        make(9, 'Fixture Officer B', 'officer: CFO', 'buy', 2_500, 208),
        make(12, 'Fixture Director C', 'director', 'buy', 3_000, 206),
        make(15, 'Fixture Officer D', 'officer: COO', 'buy', 1_800, 205),
        make(20, 'Fixture Officer E', 'officer: SVP', 'sell', 12_000, 211),
        make(31, 'Fixture Officer F', 'officer: CEO', 'sell', 30_000, 212),
        make(44, 'Fixture Officer G', 'officer: GC', 'other', 800, 0),
    ];
}

function buildLargeHolders(today: string): LargeHolderFiling[] {
    return [
        {
            filingDate: addDays(today, -40),
            filer: 'Fixture Activist Partners',
            form: 'SC 13D/A',
            percentOfClass: 5.4,
            shares: 800_000_000,
            url: 'https://www.sec.gov/Archives/edgar/data/0/fixture-13d-index.htm',
        },
        {
            filingDate: addDays(today, -200),
            filer: 'Fixture Capital Management',
            form: 'SCHEDULE 13G',
            percentOfClass: 7.48,
            shares: 1_099_000_000,
            url: 'https://www.sec.gov/Archives/edgar/data/0/fixture-13g-index.htm',
        },
    ];
}

/** 오늘 이전 `days`일(가까운 날 먼저). */
function daysBefore(today: string, days: number): Date[] {
    const base = new Date(`${today}T00:00:00Z`).getTime();
    return Array.from(
        { length: days },
        (_, i) => new Date(base - (i + 1) * MS_PER_DAY)
    );
}

function settlementDates(today: string, count: number): string[] {
    // 가장 가까운 "15일 또는 말일" 결제일들을 모아 오래된 → 최신 순으로 돌려준다.
    return daysBefore(today, 150)
        .filter(
            date =>
                date.getUTCDate() === 15 ||
                new Date(date.getTime() + MS_PER_DAY).getUTCDate() === 1
        )
        .slice(0, count)
        .map(isoDay)
        .reverse();
}

function buildShortInterest(
    today: string,
    squeeze: boolean
): ShortInterestPoint[] {
    const dates = settlementDates(today, 6);
    const base = squeeze ? 2_100_000_000 : 110_000_000;
    const step = squeeze ? 160_000_000 : 6_000_000;
    return dates.map((settlementDate, index) => ({
        settlementDate,
        shortQty: base + step * index,
        avgDailyVolume: squeeze ? 380_000_000 : 52_000_000,
        daysToCover: squeeze ? 5.5 + index * 0.3 : 1.9 + index * 0.05,
    }));
}

function buildShortVolume(today: string): ShortVolumePoint[] {
    const totalVolume = 30_000_000;
    return daysBefore(today, 120)
        .filter(date => date.getUTCDay() !== 0 && date.getUTCDay() !== 6)
        .slice(0, 70)
        .map((date, index) => {
            // `index` 0이 가장 최근 거래일 — 최근 5거래일은 비중이 급등하게 만든다.
            const ratio = index < 5 ? 0.62 : 0.44 + (index % 7) * 0.004;
            return {
                date: isoDay(date),
                shortVolume: Math.round(totalVolume * ratio),
                totalVolume,
            };
        })
        .reverse();
}

export class FakeInvestorFlowsDataProvider implements InvestorFlowsDataProvider {
    /**
     * @param collecting `true`면 13F·FINRA 파이프라인이 아직 비어 있는 모습을 흉내 낸다 — 기관 분기·상위 보유자와
     *   공매도 행이 없고(진짜 DB가 비었을 때와 같다), 내부자·13D/G·유통주식은 FMP라 그대로 있다.
     */
    constructor(
        private readonly isFinraEnabled: () => boolean,
        private readonly collecting: boolean = false
    ) {}

    /** FINRA 꺼짐 → `null`, 수집 중 → 빈 배열(진짜 DB가 비었을 때와 같다), 아니면 합성 행. */
    private shortRows<T>(finraEnabled: boolean, build: () => T[]): T[] | null {
        if (!finraEnabled) return null;
        return this.collecting ? [] : build();
    }

    async getInvestorFlowsSnapshot(
        symbol: string
    ): Promise<InvestorFlowsSnapshot | null> {
        const upper = symbol.toUpperCase();
        if (upper === 'EMPTYX') return null;
        const now = new Date();
        const today = isoDay(now);
        const quarters = buildQuarters(today);
        const latestComplete = [...quarters]
            .reverse()
            .find(quarter => quarter.complete);
        const finra = this.isFinraEnabled();
        return {
            asOf: now.toISOString(),
            sharesOutstanding: SHARES_OUTSTANDING,
            floatShares: FLOAT_SHARES,
            institutional: this.collecting
                ? { quarters: [], topHolders: [], topHoldersPeriod: null }
                : {
                      quarters,
                      topHolders: buildTopHolders(),
                      topHoldersPeriod: latestComplete?.period ?? null,
                  },
            insider: { transactions: buildInsiderTransactions(today) },
            largeHolders: buildLargeHolders(today),
            shortInterest: this.shortRows(finra, () =>
                buildShortInterest(today, upper === 'SQUEEZX')
            ),
            shortVolume: this.shortRows(finra, () => buildShortVolume(today)),
        };
    }
}
