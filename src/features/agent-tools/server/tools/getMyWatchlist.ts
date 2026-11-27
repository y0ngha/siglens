import 'server-only';
import { roundNumber } from '@/entities/bars/lib/roundIndicators';
import { DrizzlePriceAlertRepository } from '@/entities/mail-alert/api';
import { isPriceAlertLaunched } from '@/entities/mail-alert/lib/priceAlertConstants';
import {
    isPriceAlertLive,
    priceAlertAsOf,
} from '@/entities/mail-alert/lib/priceAlertExpiry';
import {
    assessFreshness,
    type FreshnessView,
} from '@/entities/ticker/lib/freshness';
import { marketProfileForAssetInfo } from '@/entities/ticker/lib/resolveMarketProfile';
import { resolveAssetInfoOrNull } from '@/entities/ticker/server/resolveAssetInfo';
import { DrizzleWatchlistRepository } from '@/entities/watchlist/api';
import type { ToolExecutor } from '@/features/agent-tools/model';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { quoteWithTimeout } from '@/shared/api/market/quoteTimeout';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { getDescriptor } from '@/shared/config/marketProfile/registry';
import { QUOTE_MAX_AGE_MS } from '@/shared/config/quoteFreshness';
import { MS_PER_SECOND } from '@/shared/config/time';
import { getDatabaseClient } from '@/shared/db/client';
import type { PriceAlertRecord } from '@/shared/db/types';
import { logToolDegrade } from '@/shared/lib/logToolDegrade';
import { withConcurrencyLimit } from '@/shared/lib/withConcurrencyLimit';

const TOOL = 'get_my_watchlist';

/**
 * 관심종목 시세 조회 동시 수(CC-1). `get_my_portfolio`와 같은 5개다 — 시세는 공유 캐시를 거치므로 대부분 적중이고
 * 이 값은 콜드 캐시에서 50종목이 한꺼번에 공급자로 나가는 것만 막는다.
 */
const QUOTE_CONCURRENCY = 5;

/** 상세 나이를 싣는 stale 종목 수 상한. 전부 stale이어도 이 필드가 결과 상한을 밀어내지 않게 한다. */
const STALE_FRESHNESS_DETAIL_LIMIT = 5;

/**
 * 결과에 싣는 종목명의 최대 글자 수(코드 포인트, 말줄임표 포함). `company_name`은 담을 때 서버가 해석한 이름이라 길이
 * 제한이 없다(클라이언트가 넘긴 이름만 `WATCHLIST_LABEL_MAX_LENGTH`로 자른다). 긴 미국 ETF·우선주 이름
 * ("iShares Trust iShares 0-5 Year High Yield Corporate Bond ETF" 같은 60자 안팎)도 대부분 그대로 들어가는 값이고,
 * 이보다 긴 이름은 뒤를 자른다 — 그래야 50종목 최악 모양이 `WATCHLIST_RESULT_MAX_CHARS` 안에 든다.
 */
export const WATCHLIST_TOOL_NAME_MAX_CHARS = 64;

/** 이름이 {@link WATCHLIST_TOOL_NAME_MAX_CHARS}를 넘으면 앞부분과 말줄임표로 줄인다(서로게이트 쌍을 가르지 않는다). */
function boundName(name: string | null): string | null {
    if (name === null) return null;
    const chars = Array.from(name);
    return chars.length > WATCHLIST_TOOL_NAME_MAX_CHARS
        ? `${chars.slice(0, WATCHLIST_TOOL_NAME_MAX_CHARS - 1).join('')}…`
        : name;
}

interface WatchlistItemView {
    symbol: string;
    name: string | null;
    /** 담은 날(`YYYY-MM-DD`, UTC). 시각은 모델에 필요 없다. */
    addedAt: string;
    currency: string;
    price: number | null;
    dayChangePct: number | null;
    priceFreshness?: FreshnessView;
}

interface WatchlistAlertView {
    symbol: string;
    condition: PriceAlertRecord['condition']['kind'];
    low?: number;
    high?: number;
    level?: number;
    basis: PriceAlertRecord['basis'];
    expiresOn: string;
}

export interface MyWatchlistView {
    asOf: string;
    source: string;
    count: number;
    stalePriceCount?: number;
    items: WatchlistItemView[];
    /** 살아 있는 가격대 알림. 알림이 공개되기 전에는 키 자체가 없고, 읽지 못하면 `null`이다. */
    priceAlerts?: WatchlistAlertView[] | null;
}

interface QuoteRead {
    price: number;
    dayChangePct: number | null;
    freshness: FreshnessView | null;
}

function staleFreshness(
    timestampSeconds: number | undefined
): FreshnessView | null {
    if (timestampSeconds === undefined || !Number.isFinite(timestampSeconds)) {
        return null;
    }
    const view = assessFreshness({
        asOfMs: timestampSeconds * MS_PER_SECOND,
        maxAgeMs: QUOTE_MAX_AGE_MS,
        nowMs: Date.now(),
    });
    return view.stale ? view : null;
}

async function readQuote(
    profile: ReturnType<typeof marketProfileForAssetInfo>,
    quoteSymbol: string
): Promise<QuoteRead | null> {
    try {
        const quote = await quoteWithTimeout(
            getCachedMarketDataProvider(sessionSpecFor(profile)),
            quoteSymbol
        );
        if (!quote || !Number.isFinite(quote.price) || quote.price <= 0) {
            return null;
        }
        return {
            price: quote.price,
            dayChangePct: Number.isFinite(quote.changesPercentage)
                ? roundNumber(quote.changesPercentage)
                : null,
            freshness: staleFreshness(quote.timestamp),
        };
    } catch (error) {
        logToolDegrade(TOOL, 'quote lookup', error);
        return null;
    }
}

interface RawItem {
    view: WatchlistItemView;
    freshness: FreshnessView | null;
}

async function readItem(row: {
    symbol: string;
    companyName: string | null;
    createdAt: Date;
}): Promise<RawItem> {
    const asset = await resolveAssetInfoOrNull(row.symbol, TOOL);
    const profile = marketProfileForAssetInfo(asset);
    const quote = await readQuote(profile, asset?.fmpSymbol ?? row.symbol);
    return {
        view: {
            symbol: row.symbol,
            name: boundName(row.companyName),
            addedAt: row.createdAt.toISOString().slice(0, 10),
            currency: getDescriptor(profile).priceFormat.currency,
            price: quote?.price ?? null,
            dayChangePct: quote?.dayChangePct ?? null,
        },
        freshness: quote?.freshness ?? null,
    };
}

function alertView(alert: PriceAlertRecord): WatchlistAlertView {
    const { condition } = alert;
    return {
        symbol: alert.symbol,
        condition: condition.kind,
        ...(condition.kind === 'enter_zone'
            ? { low: condition.low, high: condition.high }
            : { level: condition.level }),
        basis: alert.basis,
        expiresOn: alert.expiresOn,
    };
}

/** 살아 있는 가격대 알림. 읽기에 실패하면 관심종목 결과는 그대로 주고 알림만 `null`(읽지 못함)로 표시한다. */
async function readAlerts(
    userId: string
): Promise<WatchlistAlertView[] | null> {
    try {
        const rows = await new DrizzlePriceAlertRepository(
            getDatabaseClient().db
        ).listForSubscriber({ kind: 'member', userId });
        // 살아 있는 알림만: 진행 중이면서 만료 세션이 그 시장의 기대 세션 이상(발송기와 같은 규칙). 만료 뒤 정리 전의 행은 뺀다.
        const asOf = priceAlertAsOf(new Date());
        return rows
            .filter(
                row => row.status === 'active' && isPriceAlertLive(row, asOf)
            )
            .map(alertView);
    } catch (error) {
        logToolDegrade(TOOL, 'price alerts read', error);
        return null;
    }
}

/**
 * 회원의 관심종목과 시세. 최근에 담은 순이고, 시세는 `get_my_portfolio`처럼 공유 캐시를 거쳐 동시 5개씩 읽으며
 * 못 읽은 종목은 가격만 `null`로 둔다. 상세 나이는 stale인 종목에만 싣는다.
 */
export async function loadMyWatchlist(
    userId: string
): Promise<MyWatchlistView> {
    const rows = await new DrizzleWatchlistRepository(
        getDatabaseClient().db
    ).findByUser(userId);
    const newestFirst = rows.toSorted(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
    const settled = await withConcurrencyLimit(
        newestFirst,
        QUOTE_CONCURRENCY,
        readItem
    );
    const rejected = settled.find(
        (s): s is PromiseRejectedResult => s.status === 'rejected'
    );
    if (rejected) throw rejected.reason;
    const items = settled.map(
        (s): RawItem => (s as PromiseFulfilledResult<RawItem>).value
    );
    const stale = items
        .filter(
            (item): item is RawItem & { freshness: FreshnessView } =>
                item.freshness !== null
        )
        .toSorted((a, b) => b.freshness.ageMinutes - a.freshness.ageMinutes);
    const detailed = new Set(
        stale.slice(0, STALE_FRESHNESS_DETAIL_LIMIT).map(i => i.view.symbol)
    );
    const alerts = isPriceAlertLaunched()
        ? await readAlerts(userId)
        : undefined;
    return {
        asOf: new Date().toISOString(),
        source: 'SIGLENS watchlist',
        count: items.length,
        ...(stale.length > 0 ? { stalePriceCount: stale.length } : {}),
        items: items.map(item =>
            item.freshness !== null && detailed.has(item.view.symbol)
                ? { ...item.view, priceFreshness: item.freshness }
                : item.view
        ),
        ...(alerts === undefined ? {} : { priceAlerts: alerts }),
    };
}

/** `get_my_watchlist` — 회원 전용(`createToolExecutor`의 회원 전용 집합이 게스트를 `login_required`로 돌려보낸다). */
export const getMyWatchlistTool: ToolExecutor = (_args, ctx) =>
    loadMyWatchlist(ctx.userId);
