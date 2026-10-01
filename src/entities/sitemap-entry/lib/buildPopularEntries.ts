import { US_EQUITY_SESSION } from '@y0ngha/siglens-core';
import { SYMBOL_INDEXABLE_LOCALES } from '@/shared/i18n/indexableLocales';
import { sitemapAlternates } from './sitemapAlternates';
import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
import { MS_PER_HOUR } from '@/shared/config/time';
import { KR_EQUITY_SESSION } from '@/shared/api/market/sessionSpecFor';
import { lastClosedSessionCloseUtc } from '@/shared/lib/marketSessionDate';
import { SITE_URL } from '@/shared/lib/seo';
import { isKrEquitySymbol } from '@/shared/config/marketProfile/registry';
import { floorToHour } from './floorToHour';
// 게이트 정의(탭 목록·옵션 타입)는 `proseGate.ts`가 소유한다 — 크립토 빌더와
// `server.ts`도 거기서 직접 가져온다.
import { makeProseGate, type BuildPopularEntriesOptions } from './proseGate';
import type { SitemapEntry } from '../model';

/**
 * 종목 sitemap 엔트리에 다국어 대체본을 붙인다.
 *
 * 엔트리마다 손으로 `alternates`를 적지 않는 이유는 분기(산문 게이트 등)마다
 * 리터럴이 흩어지면 한 곳만 빠뜨려도 그 탭만 조용히 hreflang을 잃기 때문이다.
 * 마지막에 일괄로 붙인다.
 *
 * `SYMBOL_INDEXABLE_LOCALES`가 기본 로케일 하나인 동안에는 `sitemapAlternates`가
 * `undefined`를 돌려 XML이 지금과 바이트 단위로 동일하다.
 */
function withSymbolAlternates(entries: SitemapEntry[]): SitemapEntry[] {
    return entries.map(entry => {
        const alternates = sitemapAlternates(
            entry.url.slice(SITE_URL.length),
            SYMBOL_INDEXABLE_LOCALES
        );
        return alternates ? { ...entry, alternates } : entry;
    });
}

/**
 * POPULAR_TICKERS의 색인 대상 sub-route(차트/뉴스/공포탐욕)에 대한 sitemap 엔트리를
 * 반환한다.
 *
 * **종목당 세 탭뿐이다** (2026-10-01 SEO 감사, `docs/architecture/SEO_RECOVERY_2026_09.md`
 * §10). 종합·펀더멘털·재무제표·옵션·의회거래 다섯 탭은 페이지가 항상 noindex다
 * (`ALWAYS_NOINDEX_TAB_ROBOTS`) — 프리웜이 그 탭의 산문을 더는 굽지 않고, 종목당 산문
 * 페이지 5~7개가 "AI 생성 프로그래매틱 금융 사이트" 판정의 분모였다. 내위치 탭도 항상
 * noindex다(2026-09-11). noindex URL을 sitemap에 실으면 크롤 예산만 태우고 GSC 오류가
 * 된다. 탭을 다시 열 때는 페이지의 noindex를 걷어내고 여기에 엔트리를 되돌린다.
 *
 * 뉴스는 스냅샷 산문이 있는 종목만 싣는다({@link BuildPopularEntriesOptions}) — 산문이
 * 없으면 noindex일 수 있다(대상 탭은 `lib/proseGate.ts`의 `PROSE_GATED_SITEMAP_TABS`).
 *
 * `lastmod`는 `lastClosedSessionCloseUtc` — **마지막으로 마감된 정규 세션의 마감
 * 순간**이다. 국내 상장 종목은 KRX 세션(15:30 KST), 나머지는 NYSE 세션(16:00 ET,
 * 반장은 13:00)으로 각각 계산한다. 한 벌만 쓰면 한국 종목 lastmod가 미국 마감 시각으로
 * 나가고, NYSE 휴장일(KRX는 개장)에는 하루 전으로 되감겨 실제보다 오래된 신호를 준다.
 * 공유 헬퍼는 주말 되감기와 DST를 모두 처리하고, bars EOD 캐시 키가 쓰는 것과 같은
 * "마지막 마감 세션" 정의를 공유한다. 공포탐욕 탭도 같은 일봉으로 계산되므로 같은
 * 값을 쓴다.
 *
 * `/{ticker}/news`만 1시간 슬라이딩을 유지한다 — 뉴스는 실제로 시간 단위로 바뀌고
 * on-demand `revalidateTag`가 ISR 창 안에서도 갱신하므로 슬라이딩이 사실에 가깝다.
 * 다만 `now`를 그대로 쓰지 않고 정시로 내림한다(`floorToHour`) — 그렇지 않으면
 * 매 호출(=매 크롤)마다 값이 달라져 `maxLastModified`가 고르는 sitemap index
 * lastmod가 끝없이 "방금 바뀜"으로 나가 freshness 신호가 무력화된다.
 */
export function buildPopularEntries(
    now: Date,
    { symbolTabsWithProse }: BuildPopularEntriesOptions = {}
): SitemapEntry[] {
    const hasProse = makeProseGate({ symbolTabsWithProse });
    const usClose = lastClosedSessionCloseUtc(US_EQUITY_SESSION, now);
    const krClose = lastClosedSessionCloseUtc(KR_EQUITY_SESSION, now);
    const oneHourAgo = floorToHour(new Date(now.getTime() - MS_PER_HOUR));

    return withSymbolAlternates(
        POPULAR_TICKERS.flatMap((ticker): SitemapEntry[] => {
            const todayClose = isKrEquitySymbol(ticker) ? krClose : usClose;
            return [
                {
                    url: `${SITE_URL}/${ticker}`,
                    lastModified: todayClose,
                    changeFrequency: 'daily',
                    priority: 0.8,
                },
                ...(hasProse(ticker, 'news')
                    ? [
                          {
                              url: `${SITE_URL}/${ticker}/news`,
                              lastModified: oneHourAgo,
                              // ternary 안의 inline array literal은 outer flatMap의
                              // SitemapEntry[] annotation이 닿지 않아 'hourly'가 string
                              // 으로 widening된다 — `as const`로 좁힌다.
                              changeFrequency: 'hourly' as const,
                              priority: 0.78,
                          },
                      ]
                    : []),
                // 공포탐욕 탭은 2026-10-01부터 색인한다(`[symbol]/fear-greed/page.tsx`
                // generateMetadata 주석). 봉이 없는 종목은 페이지가 `no-price-data`로
                // noindex지만, 그런 종목은 화이트리스트에서 정리해 왔다(2026-09-17
                // 15종 제거) — 차트 엔트리와 같은 조건이다.
                {
                    url: `${SITE_URL}/${ticker}/fear-greed`,
                    lastModified: todayClose,
                    changeFrequency: 'daily',
                    priority: 0.75,
                },
            ];
        })
    );
}
