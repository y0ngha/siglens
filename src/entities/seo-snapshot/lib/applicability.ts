import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import type { MarketSessionSpec } from '@y0ngha/siglens-core';
import { type SeoSnapshotTab } from '../model';
import {
    DEFAULT_MARKET_PROFILE,
    isKrEquitySymbol,
} from '@/shared/config/marketProfile/registry';
import { type MarketProfileId } from '@/shared/config/marketProfile/types';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';

/**
 * 프리웜이 실제로 굽는 탭 — **자산군과 무관하게 차트(technical)와 뉴스 두 개뿐이다.**
 *
 * 2026-10-01 SEO 감사(`docs/architecture/SEO_RECOVERY_2026_09.md` §10)로 7탭에서 줄였다.
 * 근거는 세 가지다:
 *   - 7탭 산문 도입(07-25) 뒤 노출이 늘지 않았다(16.9 → 11.0회/일).
 *   - Googlebot의 HTML 크롤은 하루 수백 건이라 색인 URL 하나가 며칠~몇 주에 한 번
 *     읽힌다 — 매일 밤 굽는 산문 대부분은 한 번도 읽히지 않고 덮어써졌다.
 *   - 종목당 산문 페이지 5~7개는 "AI 생성 프로그래매틱 금융 사이트"의 분모 그 자체였다.
 *
 * 남긴 두 탭의 이유: 차트는 종목의 대표 URL이고, 뉴스는 매일 바뀌는 실제 데이터(기사
 * 목록)가 산문 옆에 있다. 나머지 탭(overall·fundamental·financials·congress·options)은
 * 페이지가 항상 noindex이고 sitemap에도 없다 — 방문자가 오면 클라이언트 위젯이 그때
 * 생성한다.
 *
 * 다른 탭의 seam(`harvest.ts` `TAB_SEAMS`)과 렌더러는 **일부러 남겨 둔다.** 되돌릴
 * 근거(GSC 탭별 노출)가 생기면 이 목록과 각 페이지의 noindex만 바꾸면 된다.
 *
 * 국내 종목에 options/congress가 없다는 자산군 차이는 이 두 탭과 무관해 분기가 사라졌다.
 */
export const PREWARM_TABS = [
    'technical',
    'news',
] as const satisfies readonly SeoSnapshotTab[];

/** `tab`이 프리웜 대상인지. 스냅샷 행이 계속 갱신되는 탭은 이것뿐이다. */
export function isPrewarmTab(tab: SeoSnapshotTab): boolean {
    return (PREWARM_TABS as readonly SeoSnapshotTab[]).includes(tab);
}

const TICKER_SET = new Set<string>(POPULAR_TICKERS);
const CRYPTO_SET = new Set<string>(POPULAR_CRYPTOS);

/** 프리웜 적용 탭. 화이트리스트 밖 심볼은 빈 배열. */
export function applicableTabsFor(symbol: string): SeoSnapshotTab[] {
    const upper = symbol.toUpperCase();
    if (!CRYPTO_SET.has(upper) && !TICKER_SET.has(upper)) return [];
    return [...PREWARM_TABS];
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
