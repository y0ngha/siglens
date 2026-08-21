import { getTranslations } from 'next-intl/server';
import type { PositionTranslator } from '@/widgets/portfolio-position';
import {
    BAND_COUNT,
    computePosition,
    computeVolumeByBand,
    describeAvgFloor,
    formatAmount,
    PositionTabContent,
} from '@/widgets/portfolio-position';
import { setRequestLocale } from 'next-intl/server';
import { DEFAULT_LOCALE, isLocale } from '@/shared/i18n/locales';
import { getBlockedSymbolMetadata } from '@/app/[locale]/[symbol]/symbolIndexabilityMetadata';
import { SymbolPageHeading } from '@/views/symbol';
import {
    DEFAULT_TIMEFRAME,
    SymbolRouteParams,
    isAdmissibleSymbolShape,
} from '@/shared/config/market';
import { isUnresolvableDegraded } from '@/shared/lib/symbolGuard';
import { buildDisplayName, getAssetInfoResilient } from '@/entities/ticker';
// isTabAllowedForSymbol은 barrel에서 제외 — fundamental page.tsx와 동일하게
// api.ts에서 직접 deep import한다 (entities/ticker/index.ts 상단 주석 참고).
import { isTabAllowedForSymbol } from '@/entities/ticker/api';
import { getQuantizedBarsStatic } from '@/entities/bars';
import { marketProfileOf } from '@/shared/config/marketProfile';
import {
    buildTechnicalFacts,
    RECENT_BARS_WINDOW,
} from '@/views/symbol/utils/technicalFacts';
import {
    clampSeoDescription,
    NOINDEX_SYMBOL_METADATA,
    SITE_NAME,
    SITE_URL,
    symbolMetadataFromSeo,
    type SymbolSeoContent,
} from '@/shared/lib/seo';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

// 12h — "내 위치"는 최근 가격 범위(low52w/high52w/lastClose)만 SSR로 내려주는
// 느리게 변하는 개인화 표층이다. ★평단/수익률은 client(hydration+user 게이트)라
// SSR 캐시 신선도와 무관 — overall과 동일 상한(43200s)을 재사용한다.
export const revalidate = 43200;

// generateStaticParams가 없으면 동적 라우트는 매 요청 동적 렌더돼 revalidate가
// 무력화된다(Next.js). 빈 배열 = 빌드 prebuild 없이 첫 요청에 렌더+캐시하는 on-demand
// ISR. (cacheComponents 비활성이라 빈 배열 허용)
export async function generateStaticParams(): Promise<SymbolRouteParams[]> {
    return [];
}

interface Props {
    params: Promise<{ locale: string; symbol: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale: rawLocale, symbol } = await params;
    const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
    const tSeo = await getTranslations({
        locale,
        namespace: 'shared.seo',
    });
    const upper = symbol.toUpperCase();
    // 본문 notFound()와 일관: 잘못된 ticker는 메타데이터를 비우고 noindex로 응답한다.
    if (!isAdmissibleSymbolShape(upper)) {
        return NOINDEX_SYMBOL_METADATA;
    }
    const { assetInfo, degraded } = await getAssetInfoResilient(upper);
    const blockedMetadata = await getBlockedSymbolMetadata({
        locale,
        symbol: upper,
        assetInfo,
        degraded,
        revalidateSeconds: revalidate,
    });
    if (blockedMetadata) return blockedMetadata;
    if (!assetInfo) return NOINDEX_SYMBOL_METADATA;
    // fundamental 선례와 동일: 탭 허용 여부가 본문 notFound와 어긋나면 soft-404
    // (index:true인데 body는 404)가 생긴다. 현재는 모든 market profile이
    // 'position'을 지원하지만, 이 가드는 미래에 탭 미지원 프로필이 추가돼도
    // notFound()/noindex가 함께 어긋나지 않도록 유지한다.
    if (!(await isTabAllowedForSymbol(upper, 'position'))) {
        return NOINDEX_SYMBOL_METADATA;
    }

    const displayName = buildDisplayName(assetInfo, upper, locale);
    const url = `${SITE_URL}/${upper}/position`;
    // --- 색인 방침 히스토리 ---
    // 이 탭은 원래 /account·/onboarding과 같은 개인화 surface로 취급해 항상
    // noindex였다(2026-07 seo-audit 재검토에서 재확인). 근거: 익명 방문자에게
    // SSR로 실리는 유일한 공개 콘텐츠가 low52w/high52w/lastClose 세 숫자뿐이고
    // (당시 sr-only 섹션 + PositionCta), 그 숫자조차 동일한
    // `buildTechnicalFacts`/`getQuantizedBarsStatic` 파생값이 이미 인덱싱된
    // `[symbol]`(차트)·`overall`(기술적 요약) 페이지에 노출돼 있어 새 콘텐츠가
    // 아니라 중복이었다 — 수천 심볼 × 이 얇은 템플릿은 전형적인 thin/doorway
    // 패턴이었다.
    //
    // **2026-08-19, 사용자 결정으로 index,follow로 전환한다.** 색인을 정당화하기
    // 위해 본문에 심볼별로 달라지는 콘텐츠를 추가했다 — 현재가가 최근 52주 범위
    // 안에서 몇 %/몇 층에 있는지를 서술하는 문단(`resolveCurrentPricePosition`,
    // PositionPage 본문 참고)이다. 세 숫자를 그대로 반복하던 이전과 달리, 이
    // 문단은 그 숫자를 해석한 결과(퍼센트·층수·상단부/하단부 톤)라 chart/overall
    // 페이지의 원자료 노출과는 다른 층위의 콘텐츠다. 다만 근본 데이터는 여전히
    // 동일한 low52w/high52w/lastClose에서 파생되므로(새 데이터 소스를 추가하지
    // 않았다), thin-content 우려가 완전히 해소된 것은 아니다 — 이 탭이 계속
    // sibling 탭들(fundamental/overall/news 등, 서로 다른 AI 생성 콘텐츠를
    // 가짐) 대비 가장 얇은 콘텐츠라는 사실은 sitemap 판단(아래, `buildPopularEntries`
    // 관련 논의는 커밋 설명 참고)에도 반영했다.
    //
    // 아래 두 가지는 색인 전환과 무관하게 여전히 참이다:
    // 1. 회원의 실제 ★평단·수익률(이 탭의 핵심 개인화 가치)은 client-only라
    //    크롤러는 절대 보지 못한다 — 대신 "보유종목 등록하기" CTA(PositionCta)만
    //    SSR HTML에 실린다.
    // 2. 후킹 키워드(아파트/옥상/지하)는 반드시 displayName **앞**에 온다.
    //    displayName은 koreanName+name+ticker 조합(buildDisplayName)이라
    //    종목마다 길이가 크게 달라지고(예: IBM처럼 긴 조합은 70자+), 뒤에
    //    붙이면 title/OG의 truncation(브라우저 탭·메신저 프리뷰) 또는
    //    SEO_DESCRIPTION_MAX_LENGTH(120) clamp에 잘려나가 메타포 자체가
    //    사라진다 — front-load해야 어떤 displayName 길이에서도 세 키워드가
    //    살아남는다.
    const positionTitle = tSeo('position.title', { v0: displayName });
    const positionDescription = clampSeoDescription(
        tSeo('position.description', { v0: displayName })
    );
    // sibling 인덱서블 탭(overall/fear-greed 등)과 동일 패턴 — SymbolSeoContent를
    // 만들어 symbolMetadataFromSeo에 넘긴다. title/fullTitle 분리는 그 헬퍼가
    // title을 `{ absolute }`로 감싸 root layout의 title.template("%s | Siglens")을
    // 무시하는 것과, OG/Twitter가 페이지 레벨에서 root layout을 통째로 replace하는
    // 것(브랜드 suffix가 fullTitle에만 있어야 og:title/twitter:title에서 브랜딩이
    // 유실되지 않음) 둘 다를 이미 처리한다 — 이 페이지가 그 로직을 다시 구현할
    // 필요가 없다.
    const seo: SymbolSeoContent = {
        ticker: upper,
        title: positionTitle,
        fullTitle: `${positionTitle} | ${SITE_NAME}`,
        description: positionDescription,
        url,
        keywords: buildPositionKeywords(upper, assetInfo.koreanName),
    };
    return symbolMetadataFromSeo(seo, locale);
}

/**
 * position 탭 전용 키워드. 다른 8개 심볼 탭은 `shared/lib/seo.ts`의
 * `buildSymbolXxxKeywords`로 공용화돼 있지만, 이 탭은 개인화 surface라는 특성이
 * 강해(★평단/수익률은 client-only) 다른 탭이 재사용할 이유가 없다 — 공용
 * 모듈로 옮기지 않고 이 페이지에만 둔다.
 */
function buildPositionKeywords(ticker: string, koreanName?: string): string[] {
    return [
        `${ticker} 평단`,
        `${ticker} 평단 계산`,
        `${ticker} 내 위치`,
        `${ticker} 매수 가격대`,
        `${ticker} 52주 범위`,
        ...(koreanName ? [`${koreanName} 평단`, `${koreanName} 내 위치`] : []),
        '평단 확인',
        '52주 최고가 최저가',
    ];
}

interface PriceRange {
    low52w: number;
    high52w: number;
    lastClose: number;
    /** 5개 가격대별 최근 거래량 비중(%), index 0=최저가 밴드. 집계 불가(예:
     * 전체 거래량 0)면 null — PositionBuilding은 그 경우 층 hover를 생략한다. */
    volumeByBand: number[] | null;
}

/**
 * 최근 가격 범위(공개 데이터)만 서버에서 계산한다. `getQuantizedBarsStatic`은
 * cookies()를 읽지 않는 정적 캐시 경로라 ISR cold-gen에서 안전하다.
 *
 * ⚠️ 반드시 이 헬퍼를 거친다. 이유가 둘이다:
 * 1. `getBarsAction`을 직접 부르면 cookies() → DYNAMIC_SERVER_USAGE로 ISR
 *    cold-gen이 500을 낸다.
 * 2. `getBarsStatic` + quantize를 따로 부르면 요청 스코프 dedup을 건너뛰어
 *    지표가 RSC 페이로드에 두 벌 실린다(barsStaticCache.ts JSDoc).
 * 실패는 null로 degrade해 페이지 자체가 throw하지 않게 한다 — client의
 * PositionTabContent는 low/high/lastClose가 null이어도 CTA/데이터 부족
 * 안내로 graceful 폴백한다.
 */
async function resolvePriceRange(
    ticker: string,
    fmpSymbol: string | undefined,
    marketProfile: ReturnType<typeof marketProfileOf>
): Promise<PriceRange | null> {
    try {
        // layout/page와 같은 헬퍼를 쓴다 — 이 라우트는 bars를 query 캐시에 seed하지
        // 않아 RSC 중복 직렬화와는 무관하지만, 같은 요청 안에서 layout이 이미 부른
        // 동일 인자 호출을 재사용해 unstable_cache 조회와 quantize 계산을 아낀다.
        const quantized = await getQuantizedBarsStatic(
            ticker,
            DEFAULT_TIMEFRAME,
            marketProfile,
            fmpSymbol
        );
        const facts = buildTechnicalFacts(quantized.bars, quantized.indicators);
        if (facts === null) return null;
        // buildTechnicalFacts가 low52w/high52w를 도출한 것과 동일한
        // RECENT_BARS_WINDOW(252봉) 창을 재사용한다 — 그렇지 않으면 밴드 범위
        // [low,high]와 집계 대상 봉의 시간창이 어긋난다.
        const recentBars = quantized.bars.slice(-RECENT_BARS_WINDOW);
        const volumeByBand = computeVolumeByBand(
            recentBars,
            facts.low52w,
            facts.high52w,
            BAND_COUNT
        );
        return {
            low52w: facts.low52w,
            high52w: facts.high52w,
            lastClose: facts.lastClose,
            volumeByBand,
        };
    } catch (e) {
        console.error('[PositionPage] resolvePriceRange failed:', e);
        return null;
    }
}

interface CurrentPricePosition {
    /** 0-100 정수 — lastClose가 [low52w, high52w] 안에서 차지하는 위치(clamp됨). */
    percentile: number;
    /** "N층 · 티어"(정상 범위) 또는 "옥상 위 · ..."/"지하 세대 · ..."(방어적 —
     * lastClose는 low52w/high52w를 도출한 것과 같은 봉에서 나오므로 이론상 범위를
     * 벗어나지 않는다). PositionBuilding과 동일 어휘. */
    floorLabel: string;
    /** 위치를 해석하는 한 문장(고점권/저점권/중간). */
    tone: string;
}

const RANGE_TONE_HIGH_THRESHOLD = 70;
const RANGE_TONE_LOW_THRESHOLD = 30;

/** `app.symbol.position.band` **키**를 고른다 — 표시는 렌더 쪽에서 `t()`로. */
function rangeToneKey(percentile: number): string {
    if (percentile >= RANGE_TONE_HIGH_THRESHOLD) return 'nearHigh';
    if (percentile <= RANGE_TONE_LOW_THRESHOLD) return 'nearLow';
    return 'middle';
}

/**
 * lastClose가 최근 52주 범위 안에서 몇 %/몇 층에 있는지 계산한다 — Task 1의
 * per-symbol SSR 콘텐츠(색인 정당화 근거)가 이 결과를 렌더한다.
 *
 * 회원 전용 `PositionBuilding`이 쓰는 것과 같은 어휘(저층/중층/고층/펜트하우스,
 * 옥상 위/지하 세대)를 내기 위해 `widgets/portfolio-position`의
 * `computePosition`·`describeAvgFloor`를 그대로 재사용한다 — 두 표현이 따로
 * 갈라지면(MISTAKES #2) 이 페이지와 로그인 후 빌딩 시각화가 같은 위치를 다른
 * 말로 설명하게 된다.
 *
 * `computePosition`은 `avg`(회원 평단)를 필수 인자로 받지만, 이 SSR 콘텐츠는
 * 익명 방문자용이라 개인화 평단이 없다(★평단/수익률은 client-only —
 * generateMetadata 주석의 불변식과 동일). `avg` 자리에 `lastClose`를 그대로
 * 넣는다 — `avg`는 `avg <= 0`/non-finite 가드에만 쓰이고, 실제로 읽는
 * `currentPos`/`currentClamped`는 `current` 인자만으로 독립 계산되므로
 * (positionGeometry.ts) 이 치환은 반환값에 영향을 주지 않는다.
 * `high52w <= low52w`(분모 0) 같은 퇴화 입력은 computePosition이 이미 null로
 * 가드한다 — 그 경우 이 함수도 null을 반환해 호출부가 섹션을 생략하게 한다.
 */
function resolveCurrentPricePosition(
    range: PriceRange,
    tPos: PositionTranslator,
    tBand: PositionTranslator
): CurrentPricePosition | null {
    const model = computePosition({
        low52w: range.low52w,
        high52w: range.high52w,
        current: range.lastClose,
        avg: range.lastClose,
    });
    if (model === null) return null;

    const percentile = Math.round(model.currentPos * 100);
    return {
        percentile,
        floorLabel: describeAvgFloor(
            model.currentPos,
            model.currentClamped,
            BAND_COUNT,
            tPos
        ),
        tone: tBand(rangeToneKey(percentile)),
    };
}

export default async function PositionPage({ params }: Props) {
    const { locale, symbol } = await params;
    // 정적 렌더 활성화. 이 호출이 없으면 next-intl의 서버 API가 `headers()`로
    // 폴백해 **이 라우트의 ISR이 통째로 꺼진다**(빌드 route 표에서 `●` → `ƒ`).
    // 실측으로 확인했다 — Next 16.2는 `next/root-params` 미지원이라 이 경로가 유일하다.
    setRequestLocale(locale);
    const t = await getTranslations('app.symbol');
    const upper = symbol.toUpperCase();

    if (!isAdmissibleSymbolShape(upper)) {
        notFound();
    }

    const { assetInfo, degraded } = await getAssetInfoResilient(upper);
    // degraded + digit-first 심볼 = 두 데이터 소스가 동시 다운 중이고 resolve 불가
    // → sibling 탭과 동일한 notFound 처리로 일관성 유지.
    if (isUnresolvableDegraded(upper, degraded)) notFound();
    if (!assetInfo) {
        notFound();
    }
    if (!(await isTabAllowedForSymbol(upper, 'position'))) notFound();

    const displayName = buildDisplayName(
        assetInfo,
        upper,
        isLocale(locale) ? locale : DEFAULT_LOCALE
    );
    const marketProfile = marketProfileOf(assetInfo);

    const range = await resolvePriceRange(
        upper,
        assetInfo.fmpSymbol,
        marketProfile
    );
    // range가 degrade되면(bars 실패 등) null — 섹션 자체를 생략한다(크래시도
    // 빈 껍데기 섹션도 없음). range가 있어도 high52w<=low52w 같은 퇴화 입력이면
    // resolveCurrentPricePosition이 null을 반환해 같은 방식으로 생략된다.
    const tPos = await getTranslations(
        'widgets.portfolio-position.positionNote'
    );
    const tBand = await getTranslations('app.symbol.position.band');
    const currentPricePosition = range
        ? resolveCurrentPricePosition(range, tPos, tBand)
        : null;

    return (
        // `w-full`은 필수다: 이 <main>은 SymbolLayoutJail의 `flex flex-col` 컨테이너의
        // 직계 flex item이다. flex item에 `mx-auto`(양쪽 auto margin)를 걸면 cross-axis
        // stretch가 비활성화되고(CSS Flexbox §9.4 stretch 조건 = "neither margin is auto"),
        // width가 max-w-5xl까지 채워지는 대신 자식의 shrink-to-fit(콘텐츠 폭)로 줄어든다.
        // fundamental/overall은 콘텐츠(카드·표)가 우연히 1024px보다 넓어 이 버그가
        // 드러나지 않았을 뿐 — CTA 카드 하나뿐인 이 탭(비회원/미보유)이나 options/news
        // (동일 패턴으로 이미 `w-full` 적용됨)처럼 콘텐츠가 좁으면 <main> 전체가
        // shrink-wrap돼 heading까지 화면 중앙에 떠 보인다(데스크톱만 — 모바일은 available
        // width가 max-width보다 좁아 항상 꽉 채워지므로 증상이 없다). `w-full`로 width를
        // auto가 아닌 명시값(100%)으로 만들면 stretch 비활성 조건을 우회해 sibling과
        // 동일하게 max-w-5xl까지 채워진다.
        <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
            <SymbolPageHeading>
                {t('page.927513', { v0: displayName })}
            </SymbolPageHeading>
            {/* Task 1(색인 전환 근거) — 이전엔 이 자리에 sr-only 개요 섹션만 있었다
                (noindex 시절엔 스크린리더 문맥 보강용이었을 뿐, SEO 신호가 아니었다).
                지금은 index,follow 라우트라 크롤러가 실제로 보는 유일한 본문 콘텐츠고,
                심볼마다 달라지는 숫자(퍼센트·층수)를 담아 sr-only였을 때와 달리
                시각적으로도 노출한다 — 개인화 데이터(★평단/수익률)는 여전히 전혀
                포함하지 않는다(PositionCta만 그 CTA를 맡는다). range/currentPricePosition이
                degrade되면(bars 실패, high52w<=low52w 등) 섹션 자체를 생략한다. */}
            {range && currentPricePosition && (
                <section
                    aria-labelledby="position-guide-heading"
                    className="space-y-3 rounded-lg border border-secondary-800 bg-secondary-800/30 p-5"
                >
                    <h2
                        id="position-guide-heading"
                        className="text-base font-semibold text-secondary-300"
                    >
                        {t('page.5ab35b', { v0: displayName })}
                    </h2>
                    <p className="text-sm leading-relaxed text-secondary-400">
                        {t('page.1e3497', {
                            v0: displayName,
                            v1: formatAmount(range.low52w, upper),
                        })}{' '}
                        ~{' '}
                        {t('page.44a64f', {
                            v0: formatAmount(range.high52w, upper),
                            v1: formatAmount(range.lastClose, upper),
                            v2: currentPricePosition.percentile,
                            v3: currentPricePosition.floorLabel,
                            v4: currentPricePosition.tone,
                        })}
                    </p>
                </section>
            )}
            <PositionTabContent
                symbol={upper}
                low52w={range?.low52w ?? null}
                high52w={range?.high52w ?? null}
                lastClose={range?.lastClose ?? null}
                volumeByBand={range?.volumeByBand ?? null}
            />
        </main>
    );
}
