import { US_EQUITY_SESSION } from '@y0ngha/siglens-core';
import {
    CURATED_KOREAN_NAMES,
    POPULAR_TICKERS,
} from '@/shared/config/popular-tickers';
import { MS_PER_HOUR } from '@/shared/config/time';
import { KR_EQUITY_SESSION } from '@/shared/api/market/sessionSpecFor';
import { lastClosedSessionCloseUtc } from '@/shared/lib/marketSessionDate';
import { POPULAR_OPTIONS_TICKERS } from '../config/popular-options-tickers';
import { SITE_URL } from '@/shared/lib/seo';
import { isKrEquitySymbol } from '@/shared/config/marketProfile';
import { classifyAsset } from '@/entities/ticker';
import { floorToHour } from './floorToHour';
import type { SitemapEntry } from '../model';

const POPULAR_OPTIONS_SET = new Set<string>(POPULAR_OPTIONS_TICKERS);

/**
 * POPULAR_TICKERS의 모든 sub-route(차트/뉴스/펀더멘털/재무제표/옵션/종합/공포탐욕/의회거래)에
 * 대한 sitemap 엔트리를 반환한다. 재무제표는 stock으로 분류된 티커만(ETF는 재무제표가
 * 없어 noindex), 옵션 페이지는 generated static list에 포함된 미국 티커만 포함 —
 * noindex인 종목 페이지를 sitemap에 두면 품질 신호가 약해진다.
 *
 * `lastmod`는 `lastClosedSessionCloseUtc` — **마지막으로 마감된 정규 세션의 마감
 * 순간**이다. 국내 상장 종목은 KRX 세션(15:30 KST), 나머지는 NYSE 세션(16:00 ET,
 * 반장은 13:00)으로 각각 계산한다. 한 벌만 쓰면 한국 종목 lastmod가 미국 마감 시각으로
 * 나가고, NYSE 휴장일(KRX는 개장)에는 하루 전으로 되감겨 실제보다 오래된 신호를 준다.
 * 이전에는 "오늘 20:00 UTC(미래면 어제로 클램프)"를 직접 계산했는데,
 * 요일을 보지 않아 **토·일에는 열리지도 않은 장의 마감 시각**을 lastmod로 발행했다
 * (토 20:00 UTC 이후 크롤되면 1800여 URL이 전부 그렇게 나간다). 또 DST를 무시해
 * 겨울에는 실제 마감보다 1시간 일렀다. 공유 헬퍼는 주말 되감기와 DST를 모두 처리하고,
 * bars EOD 캐시 키가 쓰는 것과 같은 "마지막 마감 세션" 정의를 공유한다.
 *
 * `/{ticker}/news`만 1시간 슬라이딩을 유지한다 — 뉴스는 실제로 시간 단위로 바뀌고
 * on-demand `revalidateTag`가 ISR 창 안에서도 갱신하므로 슬라이딩이 사실에 가깝다.
 * 다만 `now`를 그대로 쓰지 않고 정시로 내림한다(`floorToHour`) — 그렇지 않으면
 * 매 호출(=매 크롤)마다 값이 달라져 `maxLastModified`가 고르는 sitemap index
 * lastmod가 끝없이 "방금 바뀜"으로 나가 freshness 신호가 무력화된다.
 */
export function buildPopularEntries(now: Date): SitemapEntry[] {
    const usClose = lastClosedSessionCloseUtc(US_EQUITY_SESSION, now);
    const krClose = lastClosedSessionCloseUtc(KR_EQUITY_SESSION, now);
    const oneHourAgo = floorToHour(new Date(now.getTime() - MS_PER_HOUR));

    return POPULAR_TICKERS.flatMap((ticker): SitemapEntry[] => {
        const isKr = isKrEquitySymbol(ticker);
        const todayClose = isKr ? krClose : usClose;
        // ETF(SPY, TQQQ, ...)는 재무제표가 없다 — financials 페이지는
        // isEmptyFinancialsSnapshot으로 noindex를 반환한다(`[symbol]/financials/page.tsx`).
        // noindex URL을 sitemap에 실으면 크롤 예산만 태우고 품질 신호가 나빠지므로
        // stock으로 분류된 티커만 `/financials` 엔트리를 낸다.
        //
        // `name`을 반드시 넘겨야 한다 — `classifyAsset`의
        // `isKrEquitySymbol(symbol) && isKrEtfName(name)` 분기는 `name`이 없으면
        // 절대 참이 될 수 없다(`isKrEtfName(undefined)`는 항상 false). 이 인자를
        // 빼먹으면 KODEX/TIGER 같은 국내 ETF도 전부 `stock`으로 떨어져
        // `/financials`가 열리고, 그 페이지는 재무제표가 없어 영구 noindex다
        // (assetClassification.ts JSDoc이 경고하는 바로 그 시나리오).
        const isStock =
            classifyAsset(
                ticker,
                undefined,
                CURATED_KOREAN_NAMES.get(ticker)
            ) === 'stock';
        return [
            {
                url: `${SITE_URL}/${ticker}`,
                lastModified: todayClose,
                changeFrequency: 'daily',
                priority: 0.8,
            },
            {
                url: `${SITE_URL}/${ticker}/news`,
                lastModified: oneHourAgo,
                changeFrequency: 'hourly',
                priority: 0.78,
            },
            {
                url: `${SITE_URL}/${ticker}/fundamental`,
                lastModified: todayClose,
                changeFrequency: 'weekly',
                priority: 0.75,
            },
            ...(isStock
                ? [
                      {
                          url: `${SITE_URL}/${ticker}/financials`,
                          lastModified: todayClose,
                          // 아래 options/congress 분기와 같은 이유로 `as const`가 필요하다.
                          changeFrequency: 'monthly' as const,
                          priority: 0.73,
                      },
                  ]
                : []),
            // options: 미국 개별주식만 옵션 시장이 있다(POPULAR_OPTIONS_SET이 FMP 미국
            // 옵션 유니버스에서 생성됨). 한국 종목이 우연히 그 목록에 없는 것은 생성기의
            // 데이터 소스 특성일 뿐 의도적 배제가 아니었다 — `isKr` 가드로 명시한다
            // (KR_EQUITY_DESCRIPTOR.tabs에 애초에 options가 없다).
            ...(!isKr && POPULAR_OPTIONS_SET.has(ticker)
                ? [
                      {
                          url: `${SITE_URL}/${ticker}/options`,
                          lastModified: todayClose,
                          // ternary 안의 inline array literal은 outer flatMap의
                          // SitemapEntry[] annotation이 닿지 않아 'daily'가 string
                          // 으로 widening된다. 런타임 값은 항상 'daily'(=valid
                          // SitemapChangeFrequency)이므로 `as const`로 좁혀 safe.
                          changeFrequency: 'daily' as const,
                          priority: 0.75,
                      },
                  ]
                : []),
            {
                url: `${SITE_URL}/${ticker}/overall`,
                lastModified: todayClose,
                changeFrequency: 'weekly',
                priority: 0.85,
            },
            {
                url: `${SITE_URL}/${ticker}/fear-greed`,
                lastModified: todayClose,
                changeFrequency: 'daily',
                priority: 0.78,
            },
            // 국내 상장 종목은 공직자 매매 공시 제도가 없어 `/congress`가 not-found
            // UI + noindex로 나간다(`KR_EQUITY_DESCRIPTOR.tabs`에서 제외). 상태 코드는
            // 200이다 — `notFound()`가 부모 `loading.tsx`의 Suspense 안에서 던져지기
            // 때문이고, 그 계약은 `e2e/specs/kr-equity-seo.spec.ts`가 고정한다.
            // noindex URL을 sitemap에 실으면 크롤 예산만 태우고 색인 품질 신호가
            // 나빠지므로 제외한다.
            //
            // ⚠️ 2026-08 감사가 "`isStock`도 함께 걸면 레버리지 ETF의 thin한 congress를
            // 공짜로 뺄 수 있다"고 제안했으나 **실측으로 반증됐다.** 비-주식 12개 중
            // SPY(7,760자)·VTI(7,338)·QQQ(6,105)·IWM(5,674)·DIA(4,793)·TQQQ(2,148)은
            // 내용이 충분하다 — 의원들이 광범위 ETF를 실제로 매매하므로 공시가 존재한다.
            // thin한 건 레버리지·인버스 6종(LABU/NVDL/SOXL/SOXS/SQQQ/TSLL, 1,095~1,171자)
            // 뿐이다. 자산 분류로는 그 둘을 가를 수 없으므로 `isStock`을 걸지 않는다.
            ...(isKr
                ? []
                : [
                      {
                          url: `${SITE_URL}/${ticker}/congress`,
                          lastModified: todayClose,
                          // 위 options 분기와 같은 이유로 `as const`가 필요하다.
                          changeFrequency: 'weekly' as const,
                          priority: 0.75,
                      },
                  ]),
        ];
    });
}
