import 'server-only';
import { cache } from 'react';
import { getNextEarningsSchedule } from '@/entities/earnings-report/api';
import { DrizzleEarningsReportsRepository } from '@/entities/earnings-report/server/earningsReportsRepository';
import { getFinancialsSnapshot } from '@/entities/financials-statements/server/getFinancialsSnapshot';
import { getInvestorFlowsScorecard } from '@/entities/investor-flows/server/getInvestorFlowsScorecard';
import { getFundamentalDataProvider } from '@/shared/api/fmp/getFundamentalDataProvider';
import { isKrEquitySymbol } from '@/shared/config/marketProfile/registry';
import { getDatabaseClient } from '@/shared/db/client';
import { kstDateKey } from '@/shared/lib/etTimeUtils';
import { cachedDateTimeFormat } from '@/shared/lib/intlFormatCache';
import {
    buildFundamentalFacts,
    isFundamentalIndexable,
} from '../lib/buildFundamentalFacts';
import type { FundamentalFactsInput, FundamentalFactsResult } from '../model';

/** EPS 연속 판정에 읽는 최근 발표 수 — 연속이 이보다 길어도 이 수에서 멈춘다. */
const REPORTED_EPS_LIMIT = 8;

const FAILED = Symbol('failed');

/** 한 입력원이 실패하면 그 입력만 비우고 나머지 사실은 그린다(fail-open). 실패는 `FAILED`로 구분한다. */
async function settle<T>(
    label: string,
    symbol: string,
    run: () => Promise<T>
): Promise<T | typeof FAILED> {
    try {
        return await run();
    } catch (err) {
        console.warn(
            `[getFundamentalFacts] ${label} failed for ${symbol}:`,
            err
        );
        return FAILED;
    }
}

function valueOf<T>(v: T | typeof FAILED): T | null {
    return v === FAILED ? null : v;
}

/** 그 종목 시장의 오늘(`YYYY-MM-DD`) — 실적일이 시장 달력 날짜라서다. 한국은 KST, 그 외는 ET. */
function marketToday(symbol: string, now: Date): string {
    if (isKrEquitySymbol(symbol)) return kstDateKey(now);
    // en-CA는 `YYYY-MM-DD`로 낸다.
    return cachedDateTimeFormat('en-CA', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(now);
}

function latestByDate<T extends { date: string }>(
    rows: readonly T[]
): T | null {
    return rows.reduce<T | null>(
        (best, row) => (best === null || row.date > best.date ? row : best),
        null
    );
}

async function loadAnnual(
    symbol: string
): Promise<FundamentalFactsInput['annual']> {
    const snapshot = await getFinancialsSnapshot(symbol, 'annual');
    const cashFlow = latestByDate(snapshot.cashFlow);
    const balance = latestByDate(snapshot.balance);
    const income = latestByDate(snapshot.income);
    if (cashFlow === null || balance === null) return null;
    return {
        date: cashFlow.date,
        cashAndShortTermInvestments: balance.cashAndShortTermInvestments,
        operatingCashFlow: cashFlow.operatingCashFlow,
        // 다른 회계연도의 순이익을 섞지 않는다 — 날짜가 다르면 모르는 것으로 둔다.
        netIncome: income?.date === cashFlow.date ? income.netIncome : null,
        reportedCurrency: cashFlow.reportedCurrency ?? null,
    };
}

async function loadEarnings(symbol: string, today: string) {
    const { db } = getDatabaseClient();
    // 다음 일정 조회가 24h 신선도 갱신을 먼저 돌린다 — 그 뒤에 발표 행을 읽어야 같은 갱신을 본다.
    const schedule = await getNextEarningsSchedule(symbol, db);
    const reported = await new DrizzleEarningsReportsRepository(
        db
    ).listReportedEps(symbol, today, REPORTED_EPS_LIMIT);
    return { nextEarningsDate: schedule?.earningsDate ?? null, reported };
}

/**
 * 펀더멘털 탭 사실 블록과 색인 판정. 본문·`generateMetadata`·sitemap 스탬프가 이 결과 하나를
 * 쓴다(같은 요청 안에서는 React `cache`로 한 번만 읽는다).
 *
 * 입력은 전부 이미 다른 탭이 읽는 캐시 경로다 — 재무제표(24h), 수급 스코어카드(12h), 목표가·의견
 * (provider Redis), 실적(DB). 방문자가 채우는 캐시(AI 산문 유무)는 읽지 않는다: 색인 여부가
 * 방문 이력에 따라 뒤집히면 안 된다(SEO_RECOVERY P2).
 */
export const getFundamentalFacts = cache(
    async (symbol: string): Promise<FundamentalFactsResult> => {
        const today = marketToday(symbol, new Date());
        const provider = getFundamentalDataProvider(symbol);
        const [annual, flows, consensus, summary, grades, earnings] =
            await Promise.all([
                settle('financials', symbol, () => loadAnnual(symbol)),
                settle('investor-flows', symbol, () =>
                    getInvestorFlowsScorecard(symbol)
                ),
                settle('price-target-consensus', symbol, () =>
                    provider.getPriceTargetConsensus(symbol)
                ),
                settle('price-target-summary', symbol, () =>
                    provider.getPriceTargetSummary(symbol)
                ),
                settle('grades', symbol, () =>
                    provider.getGradesConsensus(symbol)
                ),
                settle('earnings', symbol, () => loadEarnings(symbol, today)),
            ]);
        const flowsValue = valueOf(flows);
        const earningsValue = valueOf(earnings);
        const facts = buildFundamentalFacts({
            today,
            annual: valueOf(annual),
            scorecard: flowsValue?.scorecard ?? null,
            priceTargetConsensus: valueOf(consensus),
            priceTargetSummary: valueOf(summary),
            grades: valueOf(grades),
            earnings: earningsValue?.reported ?? null,
            nextEarningsDate: earningsValue?.nextEarningsDate ?? null,
        });
        const complete =
            [annual, flows, consensus, summary, grades, earnings].every(
                v => v !== FAILED
            ) && flowsValue?.degraded !== true;
        return {
            facts,
            complete,
            // 입력이 하나라도 실패했으면 사실 수를 믿을 수 없다. 다른 탭처럼 degraded는 noindex로 두고
            // (얇은 페이지가 장애 동안 index로 굳지 않게), 호출부는 스탬프를 남기지 않는다.
            indexable: complete && isFundamentalIndexable(facts),
        };
    }
);
