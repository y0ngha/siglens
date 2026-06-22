import type { Timeframe } from '@y0ngha/siglens-core';

/**
 * Union of all tab route keys used in the symbol analysis page.
 * Shared between `entities/ticker` (tab guard predicate) and
 * `widgets/symbol-page` (TABS config, tabsFor). Defined in `shared` so both
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
    | 'overall';

/**
 * Composite market-profile key — one entry per REAL tradable market.
 * Not a raw {assetClass × region} cartesian: crypto has no meaningful
 * region, and currency/session/language/provider/SEO all co-vary by the
 * combination. Korean stocks slot in later as `'kr-equity'`.
 */
export type MarketProfileId = 'us-equity' | 'crypto';

/** Top-level instrument kind. Drives tab whitelist + (later) core prompt branch. */
export type AssetClass = 'equity' | 'crypto';

/** Market/region axis. Drives currency, session, language, data provider. */
export type MarketRegion = 'us' | 'global';

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
export type SessionModel = 'us-equity-et' | 'always-open';

/** Price precision rule applied by `formatPrice`. */
export type PricePrecision =
    | { kind: 'fixed'; digits: number }
    | { kind: 'integer' }
    | { kind: 'dynamic-by-magnitude' };

/** Price formatting configuration for a market profile. */
export interface PriceFormatConfig {
    currency: 'USD';
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

    dataProvider: 'fmp';
    /** Canonical symbol → FMP provider symbol. Crypto = passthrough. */
    toProviderSymbol: (canonical: string) => string;
    newsSource: 'stock' | 'crypto';

    /** US equity exchange whitelist; `null` = no exchange filter (crypto). */
    exchangeWhitelist: ReadonlySet<string> | null;
    searchSource: 'fmp-us' | 'crypto-store';

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
    sitemapLastmod: 'us-close' | 'rolling';
}
