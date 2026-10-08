import 'server-only';
import { getTranslations } from 'next-intl/server';
import {
    DrizzleEmailReportDeliveryRepository,
    DrizzleEmailReportSubscriptionRepository,
} from '@/entities/email-report/api';
import type { ReportEmailTranslator } from '@/entities/email-report/templates/reportEmail';
import { DrizzlePortfolioRepository } from '@/entities/portfolio/api';
import { getDatabaseClient } from '@/shared/db/client';
import { createEmailDispatcher } from '@/shared/email/dispatcher';
import { SITE_URL } from '@/shared/lib/seo';
import {
    createSymbolReportSources,
    loadSymbolReport,
} from './loadSymbolReport';
import type { EmailReportBatchDeps } from './runEmailReportBatch';

/** 운영 의존성. `now`는 종목 스냅샷의 신선도 판정 기준이다. */
export function createEmailReportDeps(
    secret: string,
    now: Date
): EmailReportBatchDeps {
    const { db } = getDatabaseClient();
    const portfolio = new DrizzlePortfolioRepository(db);
    const sources = createSymbolReportSources();
    return {
        subscriptions: new DrizzleEmailReportSubscriptionRepository(db),
        deliveries: new DrizzleEmailReportDeliveryRepository(db),
        findHoldings: userId => portfolio.findByUser(userId),
        loadReport: (symbol, locale) =>
            loadSymbolReport(symbol, locale, now, sources),
        // 요청 스코프가 없으니 로케일을 명시해야 한다 — 빠지면 next-intl이 `headers()`로 물러난다.
        getTranslator: async locale =>
            (await getTranslations({
                locale,
                namespace: 'entities.email-report.email',
            })) as unknown as ReportEmailTranslator,
        dispatcher: createEmailDispatcher(),
        secret,
        siteUrl: SITE_URL,
    };
}
