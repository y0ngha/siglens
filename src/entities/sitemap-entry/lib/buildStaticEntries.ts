import { US_EQUITY_SESSION } from '@y0ngha/siglens-core';

import type { NewsFeedCategoryId } from '@/entities/market-news/lib/categoryConfig';
import { KR_EQUITY_SESSION } from '@/shared/api/market/sessionSpecFor';
import { isPublicApiEnabled } from '@/shared/api/publicApiEnabled';
import {
    DEVELOPERS_PATH,
    DEVELOPERS_UPDATED_AT,
} from '@/shared/config/publicApi';
import type { TermsKind } from '@/shared/db/constants';
import {
    ABOUT_PATH,
    ABOUT_UPDATED_AT,
    METHODOLOGY_PATH,
    METHODOLOGY_UPDATED_AT,
    PRIVACY_PATH,
    TERMS_PATH,
} from '@/shared/lib/legal';
import { lastClosedSessionCloseUtc } from '@/shared/lib/marketSessionDate';
import { SITE_BUILD_DATE, SITE_URL } from '@/shared/lib/seo';
import { STATIC_INDEXABLE_LOCALES } from '@/shared/i18n/indexableLocales';

import type { SitemapEntry } from '../model';
import { buildNewsSitemapEntries } from './buildNewsSitemapEntries';
import { buildRegionEntries } from './buildRegionEntries';
import { sitemapAlternates } from './sitemapAlternates';
import { staticSitemapEntry } from './staticSitemapEntry';
import { startOfUtcDay } from './startOfUtcDay';

/** `buildStaticEntries`에 주입하는 콘텐츠 갱신 시각들. 전부 선택이다. */
export interface BuildStaticEntriesOptions {
    /**
     * 카테고리 버킷별 최신 기사 `publishedAt`. news hub(`/news`)와
     * `/news/us`는 여기서 파생한다 — 허브 값을 따로 주입받으면 카테고리와
     * 어긋난 lastmod를 발행할 수 있다(허브가 보여주는 것이 정확히 그 카테고리들이다).
     *
     * **`undefined`(로더 실패)와 `{}`(로더 성공, 기사 0건)는 다르다.** 전자는 판단 근거가
     * 없으니 전 카테고리를 싣는다(페이지의 fail-open과 일치 — 로더 장애로 카테고리가
     * 통째로 사라지는 쪽이 더 나쁘다). 후자의 키 없는 카테고리는 행이 하나도 없어 페이지가
     * 빈 상태(noindex)이므로 **뺀다.**
     */
    readonly newsLatestPublishedAt?: Partial<Record<NewsFeedCategoryId, Date>>;
    /** 활성 약관·방침 버전의 발효일. 없으면 `SITE_BUILD_DATE`로 떨어진다. */
    readonly legalEffectiveDates?: Partial<Record<TermsKind, Date>>;
    /**
     * `/backtesting`이 싣는 데이터의 마지막 케이스 진입일.
     *
     * 이 페이지의 본문은 `src/entities/backtest-case/data/data.json` 고정 산출물이라
     * 배포로 바뀌지 않는다(같은 내용의 사본이 `public/`에도 있고 손으로 맞춘다 —
     * 화면과 이 lastmod는 둘 다 `src/` 쪽을 읽는다). `SITE_BUILD_DATE`를 쓰면 릴리스마다 "방금 바뀜"을 주장하게 되고,
     * lastmod가 부정확하면 Google은 그 sitemap의 lastmod 전체를 무시한다.
     */
    readonly backtestingDataDate?: Date;
}

/**
 * 정적 라우트(home, 각 버티컬의 지역 페이지, backtesting, legal, news hub + 카테고리 페이지)의
 * sitemap 엔트리.
 *
 * **`lastmod`에 요청 시각(`now`)을 그대로 쓰지 않는다.** sitemap 라우트가
 * `force-dynamic`이라 그렇게 하면 크롤러가 가져갈 때마다 값이 바뀌어, 실제로는
 * 바뀌지 않은 페이지에도 매번 freshness 신호를 보내게 된다. 네 등급으로 나눈다:
 *
 *  1. **콘텐츠 자체의 갱신 시각** — 그 값을 알 수 있는 페이지. `/about`은
 *     `ABOUT_UPDATED_AT`, `/methodology`는 `METHODOLOGY_UPDATED_AT`(둘 다 본문
 *     상수), `/privacy`·`/terms`는 활성 약관 버전의
 *     발효일(`legalEffectiveDates`), news 계열은 그 버킷의 최신 기사
 *     `publishedAt`(`newsLatestPublishedAt`), `/backtesting`은 정적 데이터셋의
 *     마지막 진입일(`backtestingDataDate`)이다. 주입되지 않으면 4등급으로
 *     떨어진다 — 이 빌더는 I/O를 하지 않는다.
 *  2. **직전 마감 세션**(`lastClosedSessionCloseUtc`) — 거래 세션 단위로 값이
 *     바뀌는 페이지. `/fear-greed*`와 `/market*`이 여기 해당한다: 입력이 봉이라
 *     "내용이 마지막으로 바뀐 시점"이 곧 직전 마감이다. 주말·휴장·DST는 헬퍼가
 *     처리한다. 거래소가 다르므로 지역별로 따로 계산한다.
 *  3. **UTC 일 경계**(`todayUtc`) — 하루 주기로 갱신되는 페이지. `/economy*`가
 *     여기 해당한다(지표가 24시간마다 새로 들어오고 페이지 FAQ도 그렇게 밝힌다).
 *     배포 시각을 쓰면 하루에 세 번 배포한 날 세 번 바뀌었다고 주장하게 된다
 *     (2026-09-17 감사). 최신 기사 시각이 주입되지 않은 news 카테고리도 여기로
 *     떨어진다.
 *  4. **빌드 시점 고정**(`SITE_BUILD_DATE`) — 배포로만 바뀌는 페이지(home), 그리고
 *     1등급 값이 주입되지 않았을 때의 폴백(`/backtesting`·legal).
 *
 * 예외: `/symbols`는 **lastmod를 생략**한다. 본문이 상수 목록이라 배포로만 바뀌는데,
 * 4등급 값(배포 시각)을 광고하면 목록이 그대로인 릴리스에서도 "방금 바뀜"을 주장한다
 * (2026-10-04 감사). 정직한 시각이 없으면 말하지 않는다.
 *
 * `/market*`은 예전에 "1시간 슬라이딩, 정시로 내림"이었다. ISR revalidate가 1h라
 * 갱신 *주기*와는 맞았지만 lastmod가 주장하는 것은 주기가 아니라 **마지막 변경
 * 시각**이고, 장이 닫힌 뒤에는 매시간 "방금 바뀌었다"는 거짓 신호가 됐다
 * (주말 내내 그랬다). 신호 스캐너의 입력은 봉이므로 세션 마감이 사실이다 —
 * `buildPopularEntries`가 종목 URL에서 이미 쓰는 근거와 같다.
 *
 * `changeFrequency`/`priority`는 lastmod와 독립적인 편집 의도다:
 * `/fear-greed`와 news 계열은 daily + 0.8(market 0.9보다 낮고 legal 0.3보다 높음).
 *
 * `now`와 옵션만 보는 순수 함수라 테스트에서 시간 mock 없이 결정적 검증 가능하다.
 * 주입값은 라우트가 `unstable_cache`로 읽어 넘긴다.
 */
export function buildStaticEntries(
    now: Date,
    options: BuildStaticEntriesOptions = {}
): SitemapEntry[] {
    const {
        newsLatestPublishedAt,
        legalEffectiveDates = {},
        backtestingDataDate,
    } = options;
    const todayUtc = startOfUtcDay(now);
    // `/fear-greed`·`/market`은 봉이 입력이라 "직전 마감"이 곧 lastmod다. 두 지역이
    // 서로 다른 거래소를 보므로 세션도 따로 계산한다 — KRX는 06:30 UTC, NYSE는
    // 21:00 UTC에 닫혀서, 한 시계로 통일하면 하루 14시간 넘게 KR 엔트리가 실제
    // 변경 시각보다 뒤처지고 KRX만 여는 날에는 바뀌지도 않은 변경을 주장한다.
    // (`buildPopularEntries`가 종목 URL에서 이미 같은 분기를 한다.)
    const regionEntries = buildRegionEntries({
        todayUtc,
        lastUsSessionClose: lastClosedSessionCloseUtc(US_EQUITY_SESSION, now),
        lastKrSessionClose: lastClosedSessionCloseUtc(KR_EQUITY_SESSION, now),
    });
    const { categoryEntries, hubLastModified, usLastModified } =
        buildNewsSitemapEntries(now, newsLatestPublishedAt, todayUtc);

    // 공개 API 출시 전에는 `/developers`가 404라 sitemap에서도 뺀다(`isPublicApiEnabled`).
    // 본문이 카탈로그와 코드 상수(한도·오류 코드)라 lastmod는 `DEVELOPERS_UPDATED_AT` 하나다.
    // 정적 안내 페이지보다 한 단계 높은 0.5 — 외부 개발자가 검색으로 들어오는 유일한 입구지만
    // 종목·허브(0.8)만큼 자주 바뀌지는 않는다.
    const developersEntries: SitemapEntry[] = isPublicApiEnabled()
        ? [
              staticSitemapEntry(
                  DEVELOPERS_PATH,
                  DEVELOPERS_UPDATED_AT,
                  'monthly',
                  0.5
              ),
          ]
        : [];

    return [
        {
            url: SITE_URL,
            lastModified: SITE_BUILD_DATE,
            changeFrequency: 'monthly',
            priority: 1,
            alternates: sitemapAlternates('/', STATIC_INDEXABLE_LOCALES),
        },
        ...regionEntries,
        staticSitemapEntry(
            '/backtesting',
            backtestingDataDate ?? SITE_BUILD_DATE,
            'monthly',
            0.9
        ),
        {
            /**
             * 종목 디렉터리. 목록은 상수(`POPULAR_TICKERS`·`POPULAR_CRYPTOS`)라
             * 배포로만 바뀐다. 예전에는 그래서 lastmod를 배포 시각으로 뒀으나,
             * 목록이 실제로 바뀌지 않은 배포까지 "방금 바뀜"으로 나가 2026-10-04
             * 감사에서 부정확한 신호로 판정했다 — **`lastModified`를 생략**한다
             * (XML에 `<lastmod>`가 나가지 않는다).
             * priority는 허브(0.8)보다 낮게 둔다 — 이 페이지의 값은 자기 본문이
             * 아니라 종목 페이지로 내보내는 링크에 있다.
             */
            url: `${SITE_URL}/symbols`,
            changeFrequency: 'monthly',
            priority: 0.6,
            alternates: sitemapAlternates('/symbols', STATIC_INDEXABLE_LOCALES),
        },
        staticSitemapEntry('/news', hubLastModified, 'daily', 0.8),
        staticSitemapEntry('/news/us', usLastModified, 'daily', 0.8),
        ...categoryEntries,
        staticSitemapEntry(
            PRIVACY_PATH,
            legalEffectiveDates.privacy ?? SITE_BUILD_DATE,
            'yearly',
            0.3
        ),
        staticSitemapEntry(
            TERMS_PATH,
            legalEffectiveDates.tos ?? SITE_BUILD_DATE,
            'yearly',
            0.3
        ),
        // `/about` — 운영 주체·방법론·면책. legal(0.3)보다 한 단계 위: YMYL 재평가에서
        // 사이트 전체의 신뢰 앵커라 크롤러가 먼저 보게 둔다. 본문이 코드 상수라 갱신 시각도
        // 코드가 안다 — 배포 시각을 쓰면 본문을 한 줄도 안 바꾼 배포까지 "갱신됨"으로 나간다.
        staticSitemapEntry(ABOUT_PATH, ABOUT_UPDATED_AT, 'yearly', 0.4),
        // `/methodology` — 분석 방법·데이터 출처·한계·정정 정책. `/about`과 같은
        // 등급(YMYL 신뢰 앵커, 본문이 코드 상수라 lastmod도 `METHODOLOGY_UPDATED_AT`).
        // 종목 산문 하단의 출처 고지(`AnalysisProvenanceNote`)가 이 페이지로 건다.
        staticSitemapEntry(
            METHODOLOGY_PATH,
            METHODOLOGY_UPDATED_AT,
            'yearly',
            0.4
        ),
        ...developersEntries,
    ];
}
