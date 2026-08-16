import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import { POPULAR_OPTIONS_TICKERS } from '@/entities/sitemap-entry/config/popular-options-tickers';
import { SEO_SNAPSHOT_TABS, type SeoSnapshotTab } from '../model';
import { isKrEquitySymbol } from '@/shared/config/marketProfile';

const CRYPTO_TABS: readonly SeoSnapshotTab[] = ['technical', 'overall', 'news'];
/**
 * 한국 상장 종목의 prewarm 탭. `options`/`congress`가 빠진 것은 국내에 해당 시장·제도가
 * 없어 `KR_EQUITY_DESCRIPTOR.tabs`에도 없기 때문이다 — 넣으면 404 페이지를 prewarm하려다
 * 매일 밤 실패 로그만 쌓인다.
 */
const KR_EQUITY_TABS: readonly SeoSnapshotTab[] = [
    'technical',
    'overall',
    'fundamental',
    'financials',
    'news',
];
const TICKER_SET = new Set<string>(POPULAR_TICKERS);
const CRYPTO_SET = new Set<string>(POPULAR_CRYPTOS);
const OPTIONS_SET = new Set<string>(POPULAR_OPTIONS_TICKERS);

/** 자산군별 적용 탭 (spec §5 적용성 매트릭스). 화이트리스트 밖 심볼은 빈 배열. */
export function applicableTabsFor(symbol: string): SeoSnapshotTab[] {
    const upper = symbol.toUpperCase();
    if (CRYPTO_SET.has(upper)) return [...CRYPTO_TABS];
    if (!TICKER_SET.has(upper)) return [];
    if (isKrEquitySymbol(upper)) return [...KR_EQUITY_TABS];
    if (OPTIONS_SET.has(upper)) return [...SEO_SNAPSHOT_TABS];
    return SEO_SNAPSHOT_TABS.filter(t => t !== 'options');
}

export interface PrewarmSymbol {
    symbol: string;
    tabs: SeoSnapshotTab[];
}

/** 화이트리스트 전체의 prewarm 대상 — 주식 먼저, 크립토 뒤 (주말엔 주식이 fresh라 자동 skip). */
export function buildPrewarmUniverse(): PrewarmSymbol[] {
    const equities = POPULAR_TICKERS.map(symbol => ({
        symbol,
        tabs: applicableTabsFor(symbol),
    }));
    const cryptos = POPULAR_CRYPTOS.map(symbol => ({
        symbol,
        tabs: applicableTabsFor(symbol),
    }));
    return [...equities, ...cryptos];
}
