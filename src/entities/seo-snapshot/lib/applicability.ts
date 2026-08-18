import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import { POPULAR_OPTIONS_TICKERS } from '@/entities/sitemap-entry/config/popular-options-tickers';
import type { MarketSessionSpec } from '@y0ngha/siglens-core';
import { SEO_SNAPSHOT_TABS, type SeoSnapshotTab } from '../model';
import {
    DEFAULT_MARKET_PROFILE,
    isKrEquitySymbol,
    type MarketProfileId,
} from '@/shared/config/marketProfile';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';

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

/**
 * prewarm 심볼의 마켓 프로필 — 세 자산군을 **전부** 구분한다.
 *
 * `isKrEquitySymbol(s) ? 'kr-equity' : 'us-equity'` 같은 2분기를 쓰면 크립토가 조용히
 * 미국 주식으로 분류된다. 여기서 크립토를 동기로 판정할 수 있는 이유는 prewarm 유니버스가
 * `POPULAR_CRYPTOS` 정적 목록에서 나오기 때문이다 — 일반 경로의 크립토 판정은
 * `crypto_assets` DB 멤버십 조회라 async다.
 */
function prewarmProfileOf(symbol: string): MarketProfileId {
    const upper = symbol.toUpperCase();
    if (CRYPTO_SET.has(upper)) return 'crypto';
    return isKrEquitySymbol(upper) ? 'kr-equity' : DEFAULT_MARKET_PROFILE;
}

/**
 * prewarm 심볼의 시장 세션 스펙.
 *
 * 매핑 자체는 `sessionSpecFor`에 위임한다 — 그쪽은 `SessionModel` 유니온을 exhaustive
 * switch로 받아서, 새 마켓 프로필이 생기면 컴파일 에러로 결정을 강제한다. 여기서
 * if/else 표를 한 벌 더 만들면 그 가드 없는 두 번째 표가 생기고, 새 프로필이 조용히
 * 미국 주식으로 떨어진다 — 이 파일에서 실제로 한 번 일어난 실수다(크립토 오분류).
 */
export function prewarmSessionSpecFor(symbol: string): MarketSessionSpec {
    return sessionSpecFor(prewarmProfileOf(symbol));
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
