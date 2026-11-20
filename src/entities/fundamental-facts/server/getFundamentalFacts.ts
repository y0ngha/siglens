import 'server-only';
import { cache } from 'react';
import {
    earningsMarketToday,
    resolveNextEarnings,
} from '@/entities/analyst-views/lib/resolveNextEarnings';
import { loadEarningsHintBounded } from '@/entities/analyst-views/server/loadEarningsHint';
import { getNextEarningsSchedule } from '@/entities/earnings-report/api';
import { DrizzleEarningsReportsRepository } from '@/entities/earnings-report/server/earningsReportsRepository';
import { getFinancialsSnapshot } from '@/entities/financials-statements/server/getFinancialsSnapshot';
import { getInvestorFlowsScorecard } from '@/entities/investor-flows/server/getInvestorFlowsScorecard';
import { loadPageGradesConsensus } from '@/shared/api/fmp/loadPageGradesConsensus';
import { getFundamentalDataProvider } from '@/shared/api/fmp/getFundamentalDataProvider';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { SECONDS_PER_DAY, SECONDS_PER_HALF_DAY } from '@/shared/config/time';
import { getDatabaseClient } from '@/shared/db/client';
import {
    buildFundamentalFacts,
    isFundamentalIndexable,
} from '../lib/buildFundamentalFacts';
import type { FundamentalFactsInput, FundamentalFactsResult } from '../model';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';

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
            redactDbErrorForLog(err)
        );
        return FAILED;
    }
}

function valueOf<T>(v: T | typeof FAILED): T | null {
    return v === FAILED ? null : v;
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
        const today = earningsMarketToday(symbol, new Date());
        const provider = getFundamentalDataProvider(symbol);
        const [annual, flows, consensus, summary, grades, earnings, hint] =
            await Promise.all([
                settle('financials', symbol, () => loadAnnual(symbol)),
                settle('investor-flows', symbol, () =>
                    getInvestorFlowsScorecard(symbol)
                ),
                // 펀더멘털 섹션(`FundamentalSections.tsx` loadSection)과 같은 키·TTL — 캐시를 공유하고,
                // provider의 FMP no-store fetch가 `unstable_cache` 밖에서 ISR을 동적으로 뒤집지 않게 한다.
                settle('price-target-consensus', symbol, () =>
                    staticSymbolCache(
                        ['fundamental:pt-consensus', symbol],
                        symbol,
                        () => provider.getPriceTargetConsensus(symbol),
                        [],
                        SECONDS_PER_DAY
                    )
                ),
                settle('price-target-summary', symbol, () =>
                    staticSymbolCache(
                        ['fundamental:pt-summary', symbol],
                        symbol,
                        () => provider.getPriceTargetSummary(symbol),
                        [],
                        SECONDS_PER_DAY
                    )
                ),
                // 섹션과 같은 로더(`loadPageGradesConsensus`) — Yahoo 실패 fallback은 캐시에 굳지 않는다.
                // `yahooFailed`도 쓸 수 있는 값이라 성공 로드다(`complete`에 영향 없음).
                settle(
                    'grades',
                    symbol,
                    async () => (await loadPageGradesConsensus(symbol)).grades
                ),
                // DB 직접 읽기는 `unstable_cache` 밖이면 ISR 렌더를 동적으로 뒤집는다
                // (`noStoreQueryLogger` → DYNAMIC_SERVER_USAGE). 뉴스 탭 EventCalendar와 같은 12h.
                settle('earnings', symbol, () =>
                    staticSymbolCache(
                        ['fundamental-facts:earnings', symbol, today],
                        symbol,
                        () => loadEarnings(symbol, today),
                        [],
                        SECONDS_PER_HALF_DAY
                    )
                ),
                loadEarningsHintBounded(symbol),
            ]);
        const flowsValue = valueOf(flows);
        const earningsValue = valueOf(earnings);
        // DB 일정(확정 플래그 없음)과 Yahoo 힌트를 대조한다. 힌트가 없으면 일정 그대로(미확정)다.
        const nextEarnings = resolveNextEarnings({
            scheduledDate: earningsValue?.nextEarningsDate ?? null,
            scheduledConfirmed: null,
            hint,
            today,
        });
        const facts = buildFundamentalFacts({
            today,
            annual: valueOf(annual),
            scorecard: flowsValue?.scorecard ?? null,
            priceTargetConsensus: valueOf(consensus),
            priceTargetSummary: valueOf(summary),
            grades: valueOf(grades),
            earnings: earningsValue?.reported ?? null,
            nextEarningsDate: nextEarnings.date,
            nextEarningsConfirmed: nextEarnings.confirmed,
            nextEarningsSession: nextEarnings.session,
        });
        // `grades`도 완전성 판정에 넣는다: 분포는 Yahoo가 실패해도 FMP 값으로 내려오므로
        // (`CurrentGradesFmpClient`) 로드가 실패했다면 FMP 자체가 실패한 것이고, 그건 종전과 같은 의미다.
        // 실적 힌트(`hint`)는 보강이라 여기 들어가지 않는다.
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
