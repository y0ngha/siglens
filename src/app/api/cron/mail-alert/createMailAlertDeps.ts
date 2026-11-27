import 'server-only';
import {
    DrizzleMailAlertSubscriberRepository,
    DrizzleMailAlertDeliveryRepository,
} from '@/entities/mail-alert/api';
import { isMailAlertLaunched } from '@/entities/mail-alert/lib/mailAlertConstants';
import {
    getMailAlertDisclaimer,
    getMailAlertEmailTranslator,
} from '@/entities/mail-alert/server/mailAlertEmailI18n';
import { getReportSignalLabelResolver } from '@/entities/email-report/server';
import { loadBarsData } from '@/entities/bars/server/loadBarsData';
import { getCachedMarketFearGreed } from '@/entities/market-fear-greed/api/marketFearGreedCache';
import { getCachedMarketFearGreedCrypto } from '@/entities/market-fear-greed/api/marketFearGreedCryptoCache';
import { getCachedMarketFearGreedKr } from '@/entities/market-fear-greed/api/marketFearGreedKrCache';
import { DrizzlePortfolioRepository } from '@/entities/portfolio/api';
import { DrizzleSignalHistoryRepository } from '@/entities/signal-history/api';
import type { SignalHistoryMarket } from '@/entities/signal-history/types';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveMarketProfile';
import { DrizzleWatchlistRepository } from '@/entities/watchlist/api';
import { getDatabaseClient } from '@/shared/db/client';
import type { KeyedEmailDispatcher } from '@/shared/email/types';
import { SITE_URL } from '@/shared/lib/seo';
import type { MailAlertFearGreedMarket } from '@/entities/mail-alert/model';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';
import { createSymbolBriefSources } from '../email-report/loadSymbolBrief';
import type { MailAlertBatchDeps } from './runMailAlertBatch';

function alertMarketOf(profile: MarketProfileId): SignalHistoryMarket | null {
    switch (profile) {
        case 'us-equity':
            return 'us';
        case 'kr-equity':
            return 'kr';
        case 'crypto':
            return null;
    }
}

/**
 * 종목 표시 이름 — 메일 리포트가 쓰는 같은 조회(`createSymbolBriefSources().getNames`, 종목 페이지의 24시간 데이터
 * 캐시)라, 두 메일이 같은 종목을 같은 이름으로 부른다.
 */
const { getNames: getSymbolNames } = createSymbolBriefSources();

async function loadFearGreedHistory(market: MailAlertFearGreedMarket) {
    switch (market) {
        case 'us':
            return (await getCachedMarketFearGreed()).history;
        case 'kr':
            return (await getCachedMarketFearGreedKr()).history;
        case 'crypto':
            return (await getCachedMarketFearGreedCrypto()).history;
    }
}

/**
 * 운영 의존성. 신호는 `signal_events`와 같은 저장소를, 공포 탐욕은 허브 페이지가 읽는 같은 판독 캐시를,
 * 스캐너 범위 밖 종목의 일봉은 종목 페이지·메일 리포트와 같은 `loadBarsData(symbol, '1Day')`(봉 캐시)를 쓴다.
 * 발송기는 호출자가 넘긴다 — 메일 리포트 패스와 같은 인스턴스를 공유해 두 패스의 발송 속도를 함께 묶는다.
 */
export function createMailAlertBatchDeps(
    secret: string | null,
    dispatcher: KeyedEmailDispatcher
): MailAlertBatchDeps {
    const { db } = getDatabaseClient();
    const portfolio = new DrizzlePortfolioRepository(db);
    const watchlist = new DrizzleWatchlistRepository(db);
    return {
        launched: isMailAlertLaunched(),
        secret,
        siteUrl: SITE_URL,
        subscribers: new DrizzleMailAlertSubscriberRepository(db),
        deliveries: new DrizzleMailAlertDeliveryRepository(db),
        sources: {
            signalHistory: new DrizzleSignalHistoryRepository(db),
            loadFearGreedHistory,
            loadDailyBars: async symbol =>
                (await loadBarsData(symbol, '1Day')).bars,
        },
        getSymbolNames,
        findHoldings: userId => portfolio.findByUser(userId),
        findWatchlist: userId => watchlist.findByUser(userId),
        resolveMarket: async symbol =>
            alertMarketOf(await resolveMarketProfile(symbol)),
        getTranslator: getMailAlertEmailTranslator,
        getSignalLabel: async locale => getReportSignalLabelResolver(locale),
        getDisclaimer: getMailAlertDisclaimer,
        dispatcher,
    };
}
