import 'server-only';
import type { InvestorFlowsSnapshot } from '@y0ngha/siglens-core';
import type {
    ChatFlowsBlock,
    ChatFlowsKrBlock,
    ChatFlowsUsBlock,
} from '@/entities/chat-conversation/types';
import { maskUncollectedSections } from '@/entities/investor-flows/lib/investorFlowsReadiness';
import { getInvestorFlowsScorecard } from '@/entities/investor-flows/server/getInvestorFlowsScorecard';
import { isTabAllowedForSymbol } from '@/entities/ticker/api';
import type { NaverInvestorTrendRow } from '@/shared/api/naver/naverInvestorTrend';
import { isKrEquitySymbol } from '@/shared/config/marketProfile/registry';
import {
    buildKrInvestorTrend,
    loadKrInvestorTrendRows,
} from '../krInvestorTrend';
import { roundTo } from './round';
import { noData, type VisualBuildEnv, type VisualOutcome } from './types';

export const FLOWS_INSTITUTIONAL_QUARTERS = 8;
export const FLOWS_INSIDER_MONTHS = 12;
export const FLOWS_KR_DAYS = 20;

/** `asOf`(YYYY-MM-DD…)가 속한 달부터 거슬러 올라간 `count`개월 `YYYY-MM`, 오래된 순. */
export function trailingMonths(asOf: string, count: number): string[] {
    const year = Number(asOf.slice(0, 4));
    const month = Number(asOf.slice(5, 7));
    return Array.from({ length: count }, (_, i) => {
        const offset = count - 1 - i;
        const d = new Date(Date.UTC(year, month - 1 - offset, 1));
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    });
}

/**
 * 미국 수급 블록 입력: 기관 분기(최근 8개)와 내부자 월별 순매수 금액
 * (공개시장 매수 − 매도, 금액을 아는 거래만, 최근 12개월 — 거래가 없는 달은 0).
 */
export function usFlowsFrom(
    snapshot: InvestorFlowsSnapshot
): Pick<ChatFlowsUsBlock, 'institutional' | 'insiderNetValue'> {
    const institutional = snapshot.institutional.quarters
        .toSorted((a, b) => a.period.localeCompare(b.period))
        .slice(-FLOWS_INSTITUTIONAL_QUARTERS)
        .map(q => ({
            period: q.period,
            // 진행 중 분기는 부분 집계다 — 빼지 않고 표시해, 수급 탭처럼 윤곽선으로 그리게 한다.
            complete: q.complete,
            holders: q.holders,
            netShareChange: q.netShareChange,
        }));
    const signed = snapshot.insider.transactions.flatMap(t =>
        t.value === null || t.type === 'other'
            ? []
            : [
                  {
                      month: t.date.slice(0, 7),
                      value: t.type === 'buy' ? t.value : -t.value,
                  },
              ]
    );
    // 월별로 한 번에 묶어 더한다 — 요소마다 Map을 복사하는 reduce는 O(n²)다.
    const netByMonth = new Map(
        Array.from(
            Map.groupBy(signed, entry => entry.month),
            ([month, entries]) => [
                month,
                entries.reduce((sum, entry) => sum + entry.value, 0),
            ]
        )
    );
    const insiderNetValue = trailingMonths(
        snapshot.asOf,
        FLOWS_INSIDER_MONTHS
    ).map(month => ({ month, value: Math.round(netByMonth.get(month) ?? 0) }));
    const hasInsider = insiderNetValue.some(m => m.value !== 0);
    return {
        institutional,
        insiderNetValue: hasInsider ? insiderNetValue : [],
    };
}

/** 한국 수급 블록 입력 — 네이버 행(최신순)을 오래된 순 일별 순매수량으로 뒤집는다. */
export function krDaysFrom(
    rows: readonly NaverInvestorTrendRow[]
): ChatFlowsKrBlock['days'] {
    return rows
        .slice(0, FLOWS_KR_DAYS)
        .toReversed()
        .map(r => ({
            date: r.date,
            foreign: r.foreignNet,
            institution: r.institutionNet,
            individual: r.individualNet,
        }));
}

async function buildKrFlows(
    symbol: string,
    env: VisualBuildEnv
): Promise<VisualOutcome> {
    // 네이버 증권은 공식 API·약관이 없는 소스라 재배포 경로(공개 API)에서는 읽지 않는다.
    if (!env.allowUnofficialSources) return noData('source_not_allowed');
    const rows = await loadKrInvestorTrendRows(symbol);
    if (rows === null) return noData('no_investor_trend');
    const days = krDaysFrom(rows);
    const trend = buildKrInvestorTrend(rows);
    const block: ChatFlowsBlock = {
        version: 1,
        kind: 'flows',
        market: 'kr',
        asOf: env.now.toISOString(),
        symbol,
        days,
    };
    return {
        block,
        summary: {
            symbol,
            market: 'kr',
            unit: 'shares (net buying)',
            source: 'Naver Finance',
            asOf: trend?.asOf ?? null,
            days: days.length,
            sum5d: trend?.sum5d ?? null,
            sum20d: trend?.sum20d ?? null,
        },
    };
}

async function buildUsFlows(symbol: string): Promise<VisualOutcome> {
    const result = await getInvestorFlowsScorecard(symbol);
    if (result.degraded) return noData('provider_failed');
    if (result.snapshot === null) return noData('no_flows_data');
    const masked = maskUncollectedSections(result.snapshot, result.readiness);
    const { institutional, insiderNetValue } = usFlowsFrom(masked);
    if (institutional.length === 0 && insiderNetValue.length === 0)
        return noData('no_flows_data');
    const block: ChatFlowsBlock = {
        version: 1,
        kind: 'flows',
        market: 'us',
        asOf: masked.asOf,
        symbol,
        institutional,
        insiderNetValue,
    };
    // 모델이 근거로 삼는 "최신 분기"는 부분 집계가 아닌 완결 분기다.
    const latest = institutional.findLast(q => q.complete) ?? null;
    return {
        block,
        summary: {
            symbol,
            market: 'us',
            source: 'SEC 13F (quarterly) and Form 4 via FMP',
            institutionalQuarters: institutional,
            insiderNetValueUsd12m: roundTo(
                insiderNetValue.reduce((sum, m) => sum + m.value, 0),
                0
            ),
            insiderNetValueByMonth: insiderNetValue,
            latestInstitutional: latest,
        },
    };
}

/** 수급 — 미국은 기관 분기·내부자 월별, 한국은 투자자별 일별 순매수. */
export async function buildFlowsBlock(
    symbol: string,
    env: VisualBuildEnv
): Promise<VisualOutcome> {
    if (!(await isTabAllowedForSymbol(symbol, 'flows')))
        return noData('flows_not_available_for_this_symbol');
    return isKrEquitySymbol(symbol)
        ? buildKrFlows(symbol, env)
        : buildUsFlows(symbol);
}
