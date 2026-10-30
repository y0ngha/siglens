import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import { MS_PER_HOUR } from '@/shared/config/time';
import { SITE_URL } from '@/shared/lib/seo';

import type { SitemapEntry } from '../model';
import { floorToHour } from './floorToHour';
import { latestOf } from './latestOf';
import {
    makeProseGate,
    makeSnapshotTimeLookup,
    type BuildPopularEntriesOptions,
} from './proseGate';
import { startOfUtcDay } from './startOfUtcDay';
import { withSymbolAlternates } from './withSymbolAlternates';

/**
 * 크립토 종목 sitemap 엔트리.
 *
 * lastmod는 UTC 일봉 마감(가장 최근 UTC 자정)에 닻을 둔다. 크립토 일봉은 00:00Z에 닫히므로
 * 차트 데이터 근거가 그보다 자주 바뀌지 않는다(예전의 6시간 내림은 하루 네 번 신선도를
 * 과장했다 — 2026-10-05 감사). 2026-10-04 정직화(2차)부터 스냅샷 산문이 있는 두 탭은
 * 산문이 실제로 구워진 시각도 싣는다:
 *   - 차트: `max(UTC 자정, technical 스냅샷 generatedAt)` — 산문은 자정 이후에 구워지므로
 *     그 사이에 크롤한 크롤러가 변경을 놓치지 않게 한다.
 *   - 뉴스: 뉴스 스냅샷의 `generatedAt`. 실측(2026-10-04) 모든 뉴스 엔트리가 `now − 1h`였고
 *     렌더되는 스냅샷은 중앙값 32시간 전에 구워진 것이었다. 로더가 실패했을 때(스냅샷 맵
 *     없음)만 예전 폴백(`now − 1h`를 정시로 내림)을 쓴다.
 *
 * `changeFrequency`는 lastmod와 독립적인 편집 의도다:
 *   - 차트(`revalidate=21600`, 6h ISR) → `daily`.
 *   - 뉴스(`revalidate=43200`, 12h) → `daily`. 폴백 lastmod는 `floorToHour`로 내려 같은
 *     시간대 안의 반복 호출이 같은 값을 내게 한다(on-demand revalidateTag가 ISR 창 안에서
 *     페이지를 갱신할 수 있다).
 *   - 공포탐욕(`revalidate=86400`, 24h) → `daily`, UTC 자정 lastmod — 페이지가 하루에 한 번만
 *     재생성되므로 6시간 경계는 과장이다.
 *
 * 크립토에 적용되고 색인되는 탭(차트·뉴스·공포탐욕)만 싣는다. `/overall`은 2026-10-01 SEO
 * 감사부터(`ALWAYS_NOINDEX_TAB_ROBOTS`), `/position`은 2026-09-11부터 항상 noindex라 실으면
 * 크롤 예산만 태운다. 펀더멘털·재무제표·옵션·의회거래는 크립토에 렌더되지 않는다.
 */
export function buildCryptoPopularEntries(
    now: Date,
    // `buildPopularEntries`와 같은 산문 게이트 — 차트·뉴스 탭은 자산군과 무관하게
    // 렌더 가능한 산문이 없으면 noindex다. 없으면(로더 실패) 필터를 끈다.
    options: BuildPopularEntriesOptions = {}
): SitemapEntry[] {
    const hasProse = makeProseGate(options);
    const snapshotTimeOf = makeSnapshotTimeLookup(options);
    const utcMidnight = startOfUtcDay(now);
    // rolling `now - 1h`를 그대로 쓰면 매 호출마다 값이 달라져 sitemap index lastmod의
    // freshness 신호가 무력화된다 — `buildPopularEntries`의 `/news` 엔트리와 같은 이유다.
    const oneHourAgo = floorToHour(new Date(now.getTime() - MS_PER_HOUR));
    return withSymbolAlternates(
        POPULAR_CRYPTOS.flatMap((sym): SitemapEntry[] => {
            const chartLastModified = latestOf(
                [utcMidnight, snapshotTimeOf(sym, 'technical')],
                utcMidnight
            );
            return [
                // 차트 탭도 산문 게이트 대상이다(`buildPopularEntries`와 같은 규칙) — 렌더 가능한
                // technical 산문이 없으면 페이지가 noindex(`no-prose`)다.
                ...(hasProse(sym, 'technical')
                    ? [
                          {
                              url: `${SITE_URL}/${sym}`,
                              lastModified: chartLastModified,
                              changeFrequency: 'daily' as const,
                              priority: 0.8,
                          },
                      ]
                    : []),
                ...(hasProse(sym, 'news')
                    ? [
                          {
                              url: `${SITE_URL}/${sym}/news`,
                              lastModified:
                                  snapshotTimeOf(sym, 'news') ?? oneHourAgo,
                              changeFrequency: 'daily' as const,
                              priority: 0.75,
                          },
                      ]
                    : []),
                // 공포탐욕 탭은 2026-10-01부터 색인한다(`[symbol]/fear-greed/page.tsx`
                // generateMetadata 주석). `/overall`·`/position`은 항상 noindex라 싣지 않는다.
                {
                    url: `${SITE_URL}/${sym}/fear-greed`,
                    lastModified: utcMidnight,
                    changeFrequency: 'daily',
                    priority: 0.75,
                },
            ];
        })
    );
}
