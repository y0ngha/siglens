import 'server-only';
import type { ChatPortfolioBlock } from '@/entities/chat-conversation/types';
import {
    noData,
    type VisualBuildEnv,
    type VisualOutcome,
} from '@/features/agent-tools/lib/visualBlocks/types';
import {
    loadMyPortfolio,
    type HoldingView,
} from '@/features/agent-tools/server/tools/getMyPortfolio';

/** 통화 그룹마다 그리는 종목 수 상한 — 나머지는 요약에서 "그 밖"으로 접힌다. */
export const PORTFOLIO_HOLDINGS_PER_GROUP_MAX = 12;

/** 비중 큰 순(비중을 모르는 종목은 뒤). */
const byWeightDesc = (a: HoldingView, b: HoldingView): number =>
    (b.weightPct ?? -1) - (a.weightPct ?? -1);

/** 보유 뷰를 통화 그룹별 블록 입력으로 — 통화를 섞지 않는다(비중이 통화 합계 대비다). */
export function portfolioGroupsFrom(
    holdings: readonly HoldingView[]
): ChatPortfolioBlock['groups'] {
    const currencies = [...new Set(holdings.map(h => h.currency))];
    return currencies.map(currency => ({
        currency,
        holdings: holdings
            .filter(h => h.currency === currency)
            .toSorted(byWeightDesc)
            .slice(0, PORTFOLIO_HOLDINGS_PER_GROUP_MAX)
            .map(h => ({
                symbol: h.symbol,
                name: h.companyName,
                weightPct: h.weightPct,
                pnlPct: h.pnlPct,
            })),
    }));
}

/** 회원 보유종목 비중·손익 — `get_my_portfolio`와 같은 로더가 만든 값이다. */
export async function buildPortfolioBlock(
    env: VisualBuildEnv
): Promise<VisualOutcome> {
    const portfolio = await loadMyPortfolio(env.userId);
    if (portfolio.holdings.length === 0) return noData('empty_portfolio');
    const groups = portfolioGroupsFrom(portfolio.holdings);
    const block: ChatPortfolioBlock = {
        version: 1,
        kind: 'portfolio',
        asOf: portfolio.asOf,
        groups,
    };
    return {
        block,
        summary: {
            holdingsCount: portfolio.count,
            weightScope:
                portfolio.weightScope === 'currency'
                    ? 'per currency (not a blend)'
                    : 'whole portfolio',
            groups: groups.map(g => ({
                currency: g.currency,
                holdings: g.holdings,
            })),
            totals: portfolio.totals,
        },
    };
}
