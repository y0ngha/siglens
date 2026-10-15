import 'server-only';
import {
    DrizzleEmailReportDeliveryRepository,
    DrizzleEmailReportExclusionRepository,
    DrizzleEmailReportSubscriptionRepository,
} from '@/entities/email-report/api';
import {
    getReportEmailTranslator,
    getReportSignalLabelResolver,
} from '@/entities/email-report/lib/reportEmailTranslators';
import { DrizzlePortfolioRepository } from '@/entities/portfolio/api';
import { DrizzleWatchlistRepository } from '@/entities/watchlist/api';
import { getDatabaseClient } from '@/shared/db/client';
import { createEmailDispatcher } from '@/shared/email/dispatcher';
import { SITE_URL } from '@/shared/lib/seo';
import {
    createSymbolReportSources,
    loadSymbolReport,
} from './loadSymbolReport';
import { createSymbolBriefSources, loadSymbolBrief } from './loadSymbolBrief';
import type { EmailReportBatchDeps } from './runEmailReportBatch';

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
    const briefSources = createSymbolBriefSources();
    return {
        subscriptions: new DrizzleEmailReportSubscriptionRepository(db),
        deliveries: new DrizzleEmailReportDeliveryRepository(db),
        findHoldings: userId => portfolio.findByUser(userId),
        findWatchlist: userId => watchlist.findByUser(userId),
        findExcludedSymbols: userId => exclusions.findExcludedSymbols(userId),
        loadReport: (symbol, locale) =>
            loadSymbolReport(symbol, locale, now, sources),
        loadBrief: symbol => loadSymbolBrief(symbol, briefSources),
        getTranslator: getReportEmailTranslator,
        getSignalLabel: getReportSignalLabelResolver,
        dispatcher: createEmailDispatcher(),
        secret,
        siteUrl: SITE_URL,
    };
}
