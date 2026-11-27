import 'server-only';
import type { IncomeStatementRow } from '@y0ngha/siglens-core';
import { earningsMarketToday } from '@/entities/analyst-views/lib/resolveNextEarnings';
import type {
    ChatFinancialsBlock,
    ChatFinancialsQuarter,
} from '@/entities/chat-conversation/types';
import { DrizzleEarningsReportsRepository } from '@/entities/earnings-report/server/earningsReportsRepository';
import { isTabAllowedForSymbol } from '@/entities/ticker/api';
import { marketProfileForAssetInfo } from '@/entities/ticker/lib/resolveMarketProfile';
import { getFinancialStatementsProvider } from '@/shared/api/fmp/getFinancialStatementsProvider';
import { getDescriptor } from '@/shared/config/marketProfile/registry';
import { MS_PER_DAY } from '@/shared/config/time';
import { getDatabaseClient } from '@/shared/db/client';
import { logToolDegrade } from '../logToolDegrade';
import { resolveAssetInfoOrNull } from '../resolveAssetInfo';
import { noData, type VisualBuildEnv, type VisualOutcome } from './types';

export const FINANCIAL_QUARTERS_MAX = 8;
/** 실적 발표 행을 분기에 잇는 창: 분기 말일 뒤 이 일수 안에 처음 발표된 EPS. */
const EPS_MATCH_WINDOW_DAYS = 130;
/** 분기 8개에 맞는 발표 행을 넉넉히 읽는다(분기보다 발표가 많을 수 있다). */
const REPORTED_EPS_LIMIT = 12;

export interface ReportedEpsRow {
    earningsDate: string;
    epsActual: number | null;
    epsEstimated: number | null;
}

const daysBetween = (from: string, to: string): number =>
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
    MS_PER_DAY;

/** 분기 말일 뒤 창 안에서 가장 먼저 발표된 EPS 행 — 없으면 `null`. */
function reportedEpsFor(
    periodEnd: string,
    reported: readonly ReportedEpsRow[]
): ReportedEpsRow | null {
    const candidates = reported
        .filter(r => {
            const gap = daysBetween(periodEnd, r.earningsDate);
            return gap > 0 && gap <= EPS_MATCH_WINDOW_DAYS;
        })
        .toSorted((a, b) => a.earningsDate.localeCompare(b.earningsDate));
    return candidates[0] ?? null;
}

/**
 * 분기 손익 행과 발표된 EPS(예상·실제)로 막대 입력을 만든다 — 오래된 순 최근 {@link FINANCIAL_QUARTERS_MAX}개.
 * 값이 모두 비어 있는 분기는 뺀다.
 */
export function financialsQuartersFrom(
    rows: readonly IncomeStatementRow[],
    reported: readonly ReportedEpsRow[]
): ChatFinancialsQuarter[] {
    return rows
        .filter(r => r.period.startsWith('Q'))
        .toSorted((a, b) => a.date.localeCompare(b.date))
        .map((r): ChatFinancialsQuarter => {
            const match = reportedEpsFor(r.date, reported);
            return {
                period: `${r.fiscalYear} ${r.period}`,
                revenue: r.revenue,
                netIncome: r.netIncome,
                eps: r.epsDiluted ?? r.eps,
                epsActual: match?.epsActual ?? null,
                epsEstimated: match?.epsEstimated ?? null,
            };
        })
        .filter(
            q => q.revenue !== null || q.netIncome !== null || q.eps !== null
        )
        .slice(-FINANCIAL_QUARTERS_MAX);
}

async function loadReportedEps(
    symbol: string,
    now: Date
): Promise<ReportedEpsRow[]> {
    try {
        return await new DrizzleEarningsReportsRepository(
            getDatabaseClient().db
        ).listReportedEps(
            symbol,
            earningsMarketToday(symbol, now),
            REPORTED_EPS_LIMIT
        );
    } catch (error) {
        logToolDegrade('show_chart', 'reported eps', error);
        return [];
    }
}

/** 최근 8분기 매출·순이익·EPS. EPS 예상 대비는 실적 발표 행이 있을 때만 붙는다. */
export async function buildFinancialsBlock(
    symbol: string,
    env: VisualBuildEnv
): Promise<VisualOutcome> {
    if (!(await isTabAllowedForSymbol(symbol, 'financials')))
        return noData('financials_not_available_for_this_symbol');
    const [rows, reported, profile] = await Promise.all([
        getFinancialStatementsProvider(symbol).getIncomeStatements(
            symbol,
            'quarter',
            FINANCIAL_QUARTERS_MAX
        ),
        loadReportedEps(symbol, env.now),
        // 통화를 정하는 데만 쓴다 — 자산 조회가 실패해도 그림 전체를 버리지 않고 기본 시장으로 내려간다.
        resolveAssetInfoOrNull(symbol, 'show_chart').then(
            marketProfileForAssetInfo
        ),
    ]);
    const quarters = financialsQuartersFrom(rows, reported);
    if (quarters.length === 0) return noData('no_quarterly_statements');
    const currency =
        rows.find(r => r.reportedCurrency)?.reportedCurrency ??
        getDescriptor(profile).priceFormat.currency;
    const block: ChatFinancialsBlock = {
        version: 1,
        kind: 'financials',
        asOf: env.now.toISOString(),
        symbol,
        currency,
        quarters,
    };
    return {
        block,
        summary: {
            symbol,
            currency,
            quarters: quarters.map(q => ({
                period: q.period,
                revenue: q.revenue,
                netIncome: q.netIncome,
                eps: q.eps,
                ...(q.epsActual === null
                    ? {}
                    : {
                          epsActual: q.epsActual,
                          epsEstimated: q.epsEstimated,
                      }),
            })),
        },
    };
}
