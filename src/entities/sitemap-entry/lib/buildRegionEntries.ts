import {
    ALL_NAV_REGION_LINKS,
    type NavRegionId,
} from '@/shared/config/assetClassNav';

import type { SitemapEntry } from '../model';
import { staticSitemapEntry } from './staticSitemapEntry';

type NavRegionLink = (typeof ALL_NAV_REGION_LINKS)[number];

/** 지역 페이지 lastmod의 근거가 되는 시각들. */
export interface RegionLastModifiedBasis {
    /** UTC 일 경계 — 하루 주기 페이지와 24시간 거래하는 크립토의 기준. */
    readonly todayUtc: Date;
    /** 직전 마감된 NYSE 정규 세션의 마감. */
    readonly lastUsSessionClose: Date;
    /** 직전 마감된 KRX 정규 세션의 마감. */
    readonly lastKrSessionClose: Date;
}

const isMarketLink = (link: NavRegionLink): boolean =>
    link.href.startsWith('/market');

/**
 * 봉이 입력인 페이지(`/market*`·`/fear-greed*`)의 지역별 lastmod 근거. 거래소가 다르므로
 * 지역마다 다르다. 암호화폐는 24시간 거래라 세션 달력이 없다 — 지수는 마지막으로 닫힌
 * UTC 일의 봉까지 먹으므로(`fetchCryptoDailyBars`) 그 날이 닫힌 순간, 곧 오늘 UTC 자정이
 * 마지막 변경 시각이다. `Record`라 지역을 하나 더 열면 여기서 컴파일 오류로 잡힌다.
 */
const SESSION_BASIS_BY_REGION: Record<
    NavRegionId,
    keyof RegionLastModifiedBasis
> = {
    us: 'lastUsSessionClose',
    kr: 'lastKrSessionClose',
    crypto: 'todayUtc',
};

/**
 * 등급은 버티컬 성격을 따른다: `/market*`·`/fear-greed*`는 봉이 입력이라 직전 마감
 * (거래소가 다르므로 지역별로), `/economy*`는 하루 주기.
 */
function lastModifiedFor(
    link: NavRegionLink,
    basis: RegionLastModifiedBasis
): Date {
    if (!isMarketLink(link) && !link.href.startsWith('/fear-greed')) {
        // `/economy*`는 지표가 하루 주기로 갱신된다(페이지 FAQ가 그렇게 밝힌다).
        // 배포 시각을 쓰면 하루에 세 번 배포한 날 세 번 "바뀌었다"고 주장하게 된다.
        return basis.todayUtc;
    }
    return basis[SESSION_BASIS_BY_REGION[link.region]];
}

/**
 * 버티컬 지역 페이지(`/market*`·`/fear-greed*`·`/economy*`)의 sitemap 엔트리.
 *
 * `ALL_NAV_REGION_LINKS`에서 파생한다 — 내비에 열어 둔 지역과 sitemap에 광고하는 지역이
 * 어긋나지 않게 하기 위해서다. 손으로 나열하면 지역을 하나 더 열 때 sitemap 쪽을 빠뜨려도
 * 아무것도 깨지지 않는다(조용한 누락). 뉴스 지역 링크는 제외한다 — `/news/crypto`처럼
 * 카테고리 페이지와 URL이 겹쳐 뉴스 엔트리가 이미 내보내고 있어, 넣으면 같은 URL이 두 번 나간다.
 */
export function buildRegionEntries(
    basis: RegionLastModifiedBasis
): SitemapEntry[] {
    return ALL_NAV_REGION_LINKS.filter(
        link => !link.href.startsWith('/news/')
    ).map(link => {
        const isMarket = isMarketLink(link);
        return staticSitemapEntry(
            link.href,
            lastModifiedFor(link, basis),
            isMarket ? 'hourly' : 'daily',
            isMarket ? 0.9 : 0.8
        );
    });
}
