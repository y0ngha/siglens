import 'server-only';
import {
    DrizzleEmailReportDeliveryRepository,
    DrizzleEmailReportExclusionRepository,
    DrizzleEmailReportSubscriptionRepository,
} from '@/entities/email-report/api';
import {
    getReportEmailTranslator,
    getReportSignalLabelResolver,
} from '@/entities/email-report/server';
import { DrizzlePortfolioRepository } from '@/entities/portfolio/api';
import { DrizzleWatchlistRepository } from '@/entities/watchlist/api';
import { getDatabaseClient } from '@/shared/db/client';
import type { EmailDispatcher } from '@/shared/email/types';
import { SITE_URL } from '@/shared/lib/seo';
import {
    createSymbolReportSources,
    loadSymbolReport,
} from './loadSymbolReport';
import { createMarketPickSources, loadMarketPicks } from './loadMarketPicks';
import { createSymbolBriefSources, loadSymbolBrief } from './loadSymbolBrief';
import type { EmailReportBatchDeps } from './runEmailReportBatch';

/**
 * 운영 의존성. `now`는 종목 스냅샷의 신선도 판정 기준이다. `dispatcher`는 호출자가 넘긴다 — 같은 요청에서
 * 도는 알림 메일 패스와 한 인스턴스를 공유해 두 패스의 발송 속도를 함께 묶는다.
 */
export function createEmailReportDeps(
    secret: string,
    now: Date,
    dispatcher: EmailDispatcher
): EmailReportBatchDeps {
    const { db } = getDatabaseClient();
    const portfolio = new DrizzlePortfolioRepository(db);
    const watchlist = new DrizzleWatchlistRepository(db);
    const exclusions = new DrizzleEmailReportExclusionRepository(db);
    const sources = createSymbolReportSources();
    const briefSources = createSymbolBriefSources();
    const marketPickSources = createMarketPickSources();
    return {
        subscriptions: new DrizzleEmailReportSubscriptionRepository(db),
        deliveries: new DrizzleEmailReportDeliveryRepository(db),
        findHoldings: userId => portfolio.findByUser(userId),
        findWatchlist: userId => watchlist.findByUser(userId),
        findExcludedSymbols: userId => exclusions.findExcludedSymbols(userId),
        loadReport: (symbol, locale) =>
            loadSymbolReport(symbol, locale, now, sources),
        loadBrief: symbol => loadSymbolBrief(symbol, briefSources),
        loadMarketPicks: () => loadMarketPicks(marketPickSources),
        getTranslator: getReportEmailTranslator,
        getSignalLabel: getReportSignalLabelResolver,
        dispatcher,
        secret,
        siteUrl: SITE_URL,
    };
}
