import type { Timeframe } from '@y0ngha/siglens-core';

/**
 * Union of all tab route keys used in the symbol analysis page.
 * Shared between `entities/ticker` (tab guard predicate) and
 * `views/symbol/utils/symbolTabsConfig` (TABS config, tabsFor). Defined in `shared` so both
 * layers can import it without violating the FSD dependency direction.
 */
export type TabKey =
    | 'chart'
    | 'news'
    | 'fundamental'
    | 'financials'
    | 'congress'
    | 'options'
    | 'fear-greed'
    | 'overall'
    | 'position';

/**
 * Composite market-profile key — one entry per REAL tradable market.
 * Not a raw {assetClass × region} cartesian: crypto has no meaningful
 * region, and currency/session/language/provider/SEO all co-vary by the
 * combination.
 */
export type MarketProfileId = 'us-equity' | 'crypto' | 'kr-equity';

/** Top-level instrument kind. Drives tab whitelist + (later) core prompt branch. */
export type AssetClass = 'equity' | 'crypto';

/** Market/region axis. Drives currency, session, language, data provider. */
export type MarketRegion = 'us' | 'global' | 'kr';

/**
 * Interim session model (siglens-local). Each `MarketProfileDescriptor` carries
 * a `sessionModel` value that `sessionSpecFor` (`shared/api/market/sessionSpecFor.ts`)
 * translates to the core `MarketSessionSpec` (`US_EQUITY_SESSION` / `CRYPTO_SESSION`
 * from `@y0ngha/siglens-core`). The translation is already wired — this type is
 * the interim descriptor field, not the final session representation.
 *
 * Adding a new variant here requires a matching `case` in `sessionSpecFor`'s
 * exhaustive switch; the compiler will error if the switch is incomplete.
 */
export type SessionModel = 'us-equity-et' | 'always-open' | 'kr-equity-kst';

/**
 * News feed a profile reads from. `stock`/`crypto` are FMP endpoints;
 * `naver` is the Korean news search API (kr-equity — FMP has no KRX coverage).
 */
export type NewsSource = 'stock' | 'crypto' | 'naver';

/** Price precision rule applied by `formatPrice`. */
export type PricePrecision =
    | { kind: 'fixed'; digits: number }
    | { kind: 'integer' }
    | { kind: 'dynamic-by-magnitude' };

/** Price formatting configuration for a market profile. */
export interface PriceFormatConfig {
    currency: 'USD' | 'KRW';
    locale: string;
    precision: PricePrecision;
}

/** Per-market policy bundle. Downstream code reads this; never branches on raw ids. */
export interface MarketProfileDescriptor {
    id: MarketProfileId;
    assetClass: AssetClass;
    region: MarketRegion;

    priceFormat: PriceFormatConfig;

    /** Interim; upgraded to core MarketSessionSpec in the session plan. */
    sessionModel: SessionModel;

    /**
     * 시세 지연(분). `0`이면 실시간.
     *
     * 프로바이더가 응답으로 알려주는 값(yahoo `exchangeDataDelayedBy`)을 프로필 상수로
     * 고정해 둔다 — 지연 표기는 시세를 이미 받은 뒤가 아니라 **렌더 시점에** 필요한데,
     * 봉 데이터 경로에는 quote 응답이 없어 그때그때 조회할 수 없기 때문이다.
     *
     * 실측(2026-08-16): KRX 20분, 미국 0분. 값이 바뀌면 여기만 고친다.
     */
    quoteDelayMinutes: number;

    dataProvider: 'fmp' | 'yahoo';
    /** Canonical symbol → provider symbol. Crypto and kr-equity = passthrough. */
    toProviderSymbol: (canonical: string) => string;
    newsSource: NewsSource;

    /** US equity exchange whitelist; `null` = no exchange filter (crypto, kr-equity). */
    exchangeWhitelist: ReadonlySet<string> | null;
    searchSource: 'fmp-us' | 'crypto-store' | 'kr-store';

    /** Tab keys (string ids matching symbolTabsConfig). */
    tabs: readonly TabKey[];
    defaultTimeframe: Timeframe;
    allowedTimeframes: readonly Timeframe[];

    seo: {
        /**
         * JSON-LD `about` node @type (consumed by buildAssetAboutNode). crypto = null.
         * Title/description/keywords copy lives in seo.ts (Plan 5) — the descriptor
         * must NOT carry copy builders, or usEquity.ts → seo.ts → registry would cycle.
         */
        aboutNodeType: 'Corporation' | null;
    };
    sitemapLastmod: 'us-close' | 'rolling' | 'kr-close';
}
