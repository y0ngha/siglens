import 'server-only';
import { findAgentTheme } from '@y0ngha/siglens-core';
import type {
    ChatHeatmapBlock,
    ChatHeatmapMember,
} from '@/entities/chat-conversation/types';
import { getMarketSummaryStatic } from '@/entities/market-summary/api/marketSummaryStaticCache';
import { dashboardScopeOf } from '@/shared/config/dashboardScope';
import { isRankableSector, sectorDisplayNames } from '../getMarketOverview';
import { loadThemeSnapshot } from '../getThemeSnapshot';
import { logToolDegrade } from '../logToolDegrade';
import { noData, type VisualBuildEnv, type VisualOutcome } from './types';

async function buildSectorHeatmap(
    market: 'us' | 'kr',
    env: VisualBuildEnv
): Promise<VisualOutcome> {
    const summary = await getMarketSummaryStatic(
        dashboardScopeOf(market)
    ).catch((error: unknown) => {
        logToolDegrade('show_chart', 'market summary', error);
        return null;
    });
    const sectors = (summary?.sectors ?? []).filter(isRankableSector);
    if (sectors.length === 0) return noData('no_sector_quotes');
    const names = await sectorDisplayNames(env.locale, sectors);
    const rows = sectors
        .map(s => ({
            label: names[s.symbol] ?? s.koreanName,
            changePct: s.changesPercentage,
        }))
        .toSorted((a, b) => b.changePct - a.changePct);
    const block: ChatHeatmapBlock = {
        version: 1,
        kind: 'heatmap',
        asOf: env.now.toISOString(),
        scope: 'sectors',
        market,
        sectors: rows,
    };
    return {
        block,
        summary: {
            market,
            scope: 'sectors',
            unit: 'day change %',
            sectors: rows,
        },
    };
}

async function buildThemeHeatmap(
    themeId: string,
    env: VisualBuildEnv
): Promise<VisualOutcome> {
    const theme = findAgentTheme(themeId);
    if (theme === undefined)
        return { error: 'invalid_args', reason: 'unknown_theme' };
    const snapshot = await loadThemeSnapshot(theme);
    if (!snapshot.available) return noData('theme_quotes_unavailable');
    const members: ChatHeatmapMember[] = snapshot.members.map(m => ({
        symbol: m.symbol,
        name: m.name,
        changePct1d: m.changePct['1d'],
        changePct5d: m.changePct['5d'],
        changePct20d: m.changePct['20d'],
    }));
    const label = env.locale === 'ko' ? theme.nameKo : theme.nameEn;
    const block: ChatHeatmapBlock = {
        version: 1,
        kind: 'heatmap',
        asOf: snapshot.asOf,
        scope: 'theme',
        theme: theme.id,
        label,
        members,
    };
    return {
        block,
        summary: {
            theme: theme.id,
            label,
            scope: 'theme members',
            unit: 'change % over 1, 5 and 20 completed sessions',
            members,
            averageDayChangePct: snapshot.summary['1d'].avgPct,
            missing: snapshot.missing,
        },
    };
}

/** 시장 히트맵 — 테마를 주면 그 구성 종목, 아니면 시장의 섹터 등락률. */
export function buildHeatmapBlock(
    market: 'us' | 'kr',
    theme: string | null,
    env: VisualBuildEnv
): Promise<VisualOutcome> {
    return theme === null
        ? buildSectorHeatmap(market, env)
        : buildThemeHeatmap(theme, env);
}
