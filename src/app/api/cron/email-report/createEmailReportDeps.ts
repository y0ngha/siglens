import 'server-only';
import type { BarsData } from '@y0ngha/siglens-core';
import { loadBarsData } from '@/entities/bars/server/loadBarsData';
import {
    DrizzleEmailReportDeliveryRepository,
    DrizzleEmailReportExclusionRepository,
    DrizzleEmailReportSubscriptionRepository,
    DrizzleEmailReportWelcomeRepository,
} from '@/entities/email-report/api';
import {
    getReportEmailTranslator,
    getReportSignalLabelResolver,
    getReportSkillLabelResolver,
} from '@/entities/email-report/server';
import { DrizzlePortfolioRepository } from '@/entities/portfolio/api';
import { DrizzleWatchlistRepository } from '@/entities/watchlist/api';
import { getDatabaseClient } from '@/shared/db/client';
import { createEmailDispatcher } from '@/shared/email/dispatcher';
import { SITE_URL } from '@/shared/lib/seo';
import {
    createSymbolReportSources,
    loadSymbolReport,
} from './loadSymbolReport';
import { createMarketPickSources, loadMarketPicks } from './loadMarketPicks';
import { createSymbolBriefSources, loadSymbolBrief } from './loadSymbolBrief';
import {
    createSymbolDrawingsSources,
    loadSymbolDrawings,
} from './loadSymbolDrawings';
import type { EmailReportBatchDeps } from './runEmailReportBatch';

/** 한 배치가 기억해 두는 일봉 종목 수의 상한. 한 통은 최대 20종목이라 동시에 처리 중인 회원 몇 명분을 담는다. */
export const DAILY_BARS_MEMO_MAX = 100;

/** 운영 의존성. `now`는 종목 스냅샷의 신선도 판정 기준이다. */
export function createEmailReportDeps(
    secret: string,
    now: Date
): EmailReportBatchDeps {
    const { db } = getDatabaseClient();
    const portfolio = new DrizzlePortfolioRepository(db);
    const watchlist = new DrizzleWatchlistRepository(db);
    const exclusions = new DrizzleEmailReportExclusionRepository(db);
    const sources = createSymbolReportSources();
    // 일봉은 요약과 작도가 종목마다 한 번만 받는다. 이 맵은 `createEmailReportDeps` 호출(= cron 한 번)과 같이 살고,
    // 일봉(공포탐욕용 긴 이력 포함)이 커서 항목 수에 상한을 둔다 — 넘으면 가장 먼저 넣은 종목부터 뺀다. 빠진 종목을
    // 다시 읽어도 `loadBarsData`의 데이터 캐시가 받아 주므로 비용은 중복 조회 정도다.
    const dailyBars = new Map<string, Promise<BarsData>>();
    const getDailyBars = (symbol: string): Promise<BarsData> => {
        const cached = dailyBars.get(symbol);
        if (cached !== undefined) return cached;
        const pending = loadBarsData(symbol, '1Day');
        dailyBars.set(symbol, pending);
        // 실패한 조회를 기억해 두면 같은 배치의 다음 회원도 같은 실패를 받는다 — 같은 약속일 때만 지워 다시 받게 한다
        // (그 사이 상한 때문에 밀려났다 새로 들어온 약속은 건드리지 않는다).
        pending.catch(() => {
            if (dailyBars.get(symbol) === pending) dailyBars.delete(symbol);
        });
        if (dailyBars.size > DAILY_BARS_MEMO_MAX) {
            const oldest = dailyBars.keys().next();
            if (!oldest.done) dailyBars.delete(oldest.value);
        }
        return pending;
    };
    const briefSources = createSymbolBriefSources(getDailyBars);
    const marketPickSources = createMarketPickSources();
    const drawingsSources = createSymbolDrawingsSources(getDailyBars);
    return {
        subscriptions: new DrizzleEmailReportSubscriptionRepository(db),
        deliveries: new DrizzleEmailReportDeliveryRepository(db),
        welcomes: new DrizzleEmailReportWelcomeRepository(db),
        findHoldings: userId => portfolio.findByUser(userId),
        findWatchlist: userId => watchlist.findByUser(userId),
        findExcludedSymbols: userId => exclusions.findExcludedSymbols(userId),
        loadReport: (symbol, locale) =>
            loadSymbolReport(symbol, locale, now, sources),
        loadBrief: symbol => loadSymbolBrief(symbol, briefSources),
        loadMarketPicks: () => loadMarketPicks(marketPickSources),
        loadDrawings: (symbols, localDate) =>
            loadSymbolDrawings(symbols, localDate, now, drawingsSources),
        getTranslator: getReportEmailTranslator,
        getSignalLabel: getReportSignalLabelResolver,
        getSkillLabel: getReportSkillLabelResolver,
        dispatcher: createEmailDispatcher(),
        secret,
        siteUrl: SITE_URL,
    };
}
