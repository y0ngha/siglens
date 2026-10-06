import { getTranslations } from 'next-intl/server';
import type { PositionTranslator } from '@/widgets/portfolio-position/lib/positionBuildingNotes';
import {
    BAND_COUNT,
    computePosition,
} from '@/widgets/portfolio-position/lib/positionGeometry';
import { computeVolumeByBand } from '@/widgets/portfolio-position/lib/volumeByBand';
import {
    describeFloor,
    formatAmountAligned,
} from '@/widgets/portfolio-position/lib/positionBuildingNotes';
import { PositionTabContent } from '@/widgets/portfolio-position/ui/PositionTabContent';
import { resolveLocale } from '@/shared/i18n/locales';
import { getBlockedSymbolMetadata } from '@/app/[locale]/[symbol]/symbolIndexabilityMetadata';
import { SymbolPageHeading } from '@/views/symbol/ui/SymbolPageHeading';
import { SymbolRouteParams } from '@/shared/config/market';
import { isAdmissibleSymbolShape } from '@/shared/config/ticker';
import { isUnresolvableDegraded } from '@/shared/lib/symbolGuard';
import { buildAssetAboutNode } from '@/entities/ticker/lib/assetClassification';
import { buildDisplayName } from '@/entities/ticker/lib/ticker';
import { getAssetInfoResilient } from '@/entities/ticker/lib/getAssetInfoResilient';
import { requireResolvableAsset } from '@/app/[locale]/[symbol]/requireResolvableAsset';
import { isTabAllowedForSymbol } from '@/entities/ticker/api';
import { getSessionBarsStatic } from '@/entities/bars/lib/sessionBarsStaticCache';
import {
    getDescriptor,
    marketProfileOf,
} from '@/shared/config/marketProfile/registry';
import {
    buildTechnicalFacts,
    RECENT_BARS_WINDOW,
} from '@/entities/bars/lib/technicalFacts';
import {
    buildBreadcrumbJsonLd,
    buildSymbolPositionSeoContent,
    buildSymbolSeoContent,
    NOINDEX_SYMBOL_METADATA,
    symbolMetadataFromSeo,
} from '@/shared/lib/seo';
import { buildSymbolWebPageJsonLd } from '@/app/[locale]/[symbol]/symbolWebPageJsonLd';
import { JsonLd } from '@/shared/ui/JsonLd';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { enterLocale } from '@/shared/lib/enterLocale';

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
    const locale = resolveLocale(rawLocale);
    const tSeo = await getTranslations({ locale, namespace: 'shared.seo' });
    const upper = symbol.toUpperCase();
    // 본문·레이아웃 notFound()와 일관: 형식이 잘못된 세그먼트는 메타데이터 단계에서도 404다.
    // 레이아웃이 notFound()를 던져도 이 페이지의 generateMetadata 결과가 이기므로, 여기서
    // 메타를 돌려주면 404 응답에 홈 상속 title·og가 얹힌다(e2e `not-found.spec.ts`).
    if (!isAdmissibleSymbolShape(upper)) notFound();
    // 존재하지 않는 심볼은 레이아웃과 같은 판정으로 여기서도 404다(`requireResolvableAsset`).
    const { assetInfo, degraded } = await requireResolvableAsset(upper);
    // 본문 notFound와 같은 판정: 탭이 없는 종목은 메타데이터 단계에서도(차단 메타보다 먼저) 404다. 현재는 모든
    // market profile이 'position'을 지원하지만, 미래에 탭 미지원 프로필이 추가돼도 404 응답에
    // 탭 카피 + self-canonical이 얹히지 않도록 유지한다.
    if (!(await isTabAllowedForSymbol(upper, 'position'))) notFound();
    const blockedMetadata = await getBlockedSymbolMetadata({
        locale,
        symbol: upper,
        assetInfo,
        degraded,
        revalidateSeconds: revalidate,
        // 탭 카피를 쓴다 — 없으면 차단된 position 페이지가 차트 탭과 같은 title·description을
        // 내 한 종목에 중복 문서가 둘 생긴다(네이버 중복 감지, #949와 같은 부류).
        tab: 'position',
    });
    if (blockedMetadata) return blockedMetadata;
    const displayName = buildDisplayName(assetInfo, upper, locale);

    /*
     * `/position`은 **항상 noindex**다 (2026-09-11 SEO 회복 감사, 2026-08-19의
     * "Task 1이 색인을 정당화한다" 결정을 되돌림).
     *
     * 실측: 인기 종목 8종의 SSR 고유 텍스트가 868~1,222자로 형제 탭(2~8천자)의
     * 1/3 이하고, 그 전부가 52주 범위 밴드 + 층 라벨이라는 **템플릿 문장**이다.
     * 2026-07 핵심 업데이트가 이 사이트를 강등한 근거가 바로 "숫자만 바뀌는
     * 템플릿 페이지 수만 개"였는데, 그 뒤에 이 탭을 색인·sitemap에 402 URL로
     * 더한 셈이 됐다(PR #791). 검색 수요도 없다 — GSC 16개월 실적에 `/position`
     * 노출은 0건이고, 페이지의 본체(★평단·수익률)는 로그인 후 클라이언트에서만
     * 그려진다. 색인 코퍼스를 "산문이 있는 페이지"로 좁히는 것이 회복 전략의
     * 1순위라 이 탭은 빼는 것이 맞다.
     *
     * 훅 카피(title/OG/Twitter)는 그대로 둔다 — 공유 카드는 noindex와 무관하게
     * 필요하다. `NOINDEX_SYMBOL_METADATA`를 뒤에 스프레드해 robots만
     * 덮는다 — canonical은 `symbolMetadataFromSeo`의 self-canonical을 그대로 둔다.
     */
    return {
        ...symbolMetadataFromSeo(
            buildSymbolPositionSeoContent(upper, tSeo, {
                displayName,
                koreanName: assetInfo.koreanName,
            }),
            locale
        ),
        ...NOINDEX_SYMBOL_METADATA,
    };
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
 * 최근 가격 범위(공개 데이터)만 서버에서 계산한다. `getSessionBarsStatic`은
 * cookies()를 읽지 않는 정적 캐시 경로라 ISR cold-gen에서 안전하다.
 *
 * ⚠️ 반드시 이 헬퍼를 거친다. 이유가 둘이다:
 * 1. `getBarsAction`을 직접 부르면 cookies() → DYNAMIC_SERVER_USAGE로 ISR
 *    cold-gen이 500을 낸다.
 * 2. `getQuantizedBarsStatic`(봉 캐시 revalidate 6h)을 읽으면 Next 16.3이 이 라우트
 *    (12h 선언)를 6h로 clamp한다 — 렌더 중 읽힌 `unstable_cache` revalidate의 최솟값이
 *    라우트 revalidate가 된다. `getSessionBarsStatic`은 마지막 마감 세션 날짜를 키로 둬
 *    revalidate 24h로도 세션 롤마다 갱신된다(`sessionBarsStaticCache.ts` JSDoc).
 *    이 탭이 쓰는 건 봉(52주 범위·종가·거래량)뿐이라 지표가 빈 축소판으로 충분하다.
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
        // 마지막 마감 세션까지의 봉이다(장중 형성 봉 제외 — ISR HTML 결정성). 지표는
        // 비어 있으므로 `buildTechnicalFacts`의 rsi·macd는 null이고, 이 탭은 그 둘을 읽지 않는다.
        const quantized = await getSessionBarsStatic(
            ticker,
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

/**
 * 층 라벨과 **같은 밴드 경계**로 톤을 고른다.
 *
 * 예전에는 70/30 퍼센타일 리터럴을 썼는데, 층 라벨은 `BAND_COUNT`(=5) 기준
 * 20% 폭 밴드를 쓴다. 두 경계가 어긋나 60~70% 구간에서
 * "68% 지점 — 4층 · 고층에 해당합니다. 최근 1년 고점과 저점 사이 중간
 * 지점이에요."처럼 한 문장 안에서 스스로를 부정했다(NVDA·005930.KS 실측).
 * 20~30% 구간도 "중층 + 하단부"로 같은 모순이 났다.
 *
 * `describeFloorTier`의 매핑(0→저층, 1~2→중층, 3→고층, 4→펜트하우스)을 따라
 * 최하 밴드는 하단부, 상위 두 밴드는 상단부, 나머지는 중간이다. 리터럴이
 * 아니라 밴드 인덱스에서 파생하므로 `BAND_COUNT`가 바뀌어도 함께 움직인다.
 */
function rangeToneKey(currentPos: number): string {
    const band = Math.min(BAND_COUNT - 1, Math.floor(currentPos * BAND_COUNT));
    // 고층(BAND_COUNT-2)과 펜트하우스(BAND_COUNT-1).
    if (band >= BAND_COUNT - 2) return 'nearHigh';
    if (band === 0) return 'nearLow';
    return 'middle';
}

/**
 * lastClose가 최근 52주 범위 안에서 몇 %/몇 층에 있는지 계산한다 — Task 1의
 * per-symbol SSR 콘텐츠가 이 결과를 렌더한다. 2026-08-19~2026-09-11 사이엔
 * 이 콘텐츠가 색인 근거였지만, 지금은 항상 noindex라(generateMetadata 주석
 * 참고) 색인과 무관하게 방문자에게 보여주는 콘텐츠로만 유지한다.
 *
 * 회원 전용 `PositionBuilding`이 쓰는 것과 같은 어휘(저층/중층/고층/펜트하우스,
 * 옥상 위/지하 세대)를 내기 위해 `widgets/portfolio-position`의
 * `computePosition`·`describeFloor`를 그대로 재사용한다 — 두 표현이 따로
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
        floorLabel: describeFloor(
            model.currentPos,
            model.currentClamped,
            BAND_COUNT,
            tPos
        ),
        // 반올림된 퍼센타일이 아니라 `describeFloor`가 받는 것과 **같은**
        // 원본 위치를 넘긴다 — 반올림을 거치면 경계에서 둘이 또 갈린다.
        tone: tBand(rangeToneKey(model.currentPos)),
    };
}

export default async function PositionPage({ params }: Props) {
    const { locale: rawLocale, symbol } = await params;
    const locale = enterLocale(rawLocale);
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

    const displayName = buildDisplayName(assetInfo, upper, locale);
    const marketProfile = marketProfileOf(assetInfo);

    // 구조화 데이터 — 이 탭만 9개 심볼 탭 중 유일하게 WebPage/BreadcrumbList가
    // 없었다(2026-08-24 프로덕션 실측: `/{ticker}/position`의 JSON-LD는 루트
    // 레이아웃이 넣는 `WebSite` 하나뿐). 당시(index,follow 시절) 색인 대상
    // 라우트였는데 자기가 무슨 페이지인지, 사이트 어디에 속하는지를 아무것도
    // 선언하지 않던 상태였다 — 지금은 noindex지만 WebPage/BreadcrumbList
    // 자체는 페이지 정체성 선언으로서 유효해 그대로 유지한다.
    // FAQPage는 넣지 않는다 — Google이 2023-08부터 대부분 사이트에서 FAQ 리치
    // 결과를 중단해 표시 이득이 없고, 402개 종목에 같은 문답을 복제하면 이
    // 탭이 이미 가장 얇다는 문제(아래 색인 방침 히스토리)를 키우기만 한다.
    const tSeo = await getTranslations('shared.seo');
    const seo = buildSymbolPositionSeoContent(upper, tSeo, {
        displayName,
        koreanName: assetInfo.koreanName,
    });
    const webPageJsonLd = buildSymbolWebPageJsonLd({
        url: seo.url,
        name: seo.fullTitle,
        description: seo.description,
        about: buildAssetAboutNode(
            upper,
            assetInfo.koreanName ?? assetInfo.name,
            assetInfo.fmpSymbol,
            getDescriptor(marketProfile).assetClass
        ),
        locale,
    });
    // sibling 탭과 동일한 3단계 — buildBreadcrumbJsonLd가 Siglens를 자동 prepend한다.
    // 셋째 마디 이름은 헤더 가시 브레드크럼(`SymbolLayoutHeader`)과 같은 `shared.symbolTab` 키다 —
    // 구글은 마크업과 화면 텍스트가 다르면 breadcrumb 마크업을 무시한다.
    const tTab = await getTranslations('shared.symbolTab');
    const breadcrumbJsonLd = buildBreadcrumbJsonLd(
        [
            { name: displayName, url: buildSymbolSeoContent(upper, tSeo).url },
            { name: tTab('position'), url: seo.url },
        ],
        locale
    );

    // range가 degrade되면(bars 실패 등) null — 섹션 자체를 생략한다(크래시도
    // 빈 껍데기 섹션도 없음). range가 있어도 high52w<=low52w 같은 퇴화 입력이면
    // resolveCurrentPricePosition이 null을 반환해 같은 방식으로 생략된다.
    const [range, tPos, tBand] = await Promise.all([
        resolvePriceRange(upper, assetInfo.fmpSymbol, marketProfile),
        getTranslations('widgets.portfolio-position.positionNote'),
        getTranslations('app.symbol.position.band'),
    ]);
    const currentPricePosition = range
        ? resolveCurrentPricePosition(range, tPos, tBand)
        : null;

    // <main>의 `w-full`은 필수다: 이 <main>은 SymbolLayoutJail의 `flex flex-col`
    // 컨테이너의 직계 flex item이다. flex item에 `mx-auto`(양쪽 auto margin)를 걸면
    // cross-axis stretch가 비활성화되고(CSS Flexbox §9.4 stretch 조건 = "neither
    // margin is auto"), width가 max-w-5xl까지 채워지는 대신 자식의 shrink-to-fit
    // (콘텐츠 폭)로 줄어든다.
    // fundamental/overall은 콘텐츠(카드·표)가 우연히 1024px보다 넓어 이 버그가
    // 드러나지 않았을 뿐 — CTA 카드 하나뿐인 이 탭(비회원/미보유)이나 options/news
    // (동일 패턴으로 이미 `w-full` 적용됨)처럼 콘텐츠가 좁으면 <main> 전체가
    // shrink-wrap돼 heading까지 화면 중앙에 떠 보인다(데스크톱만 — 모바일은 available
    // width가 max-width보다 좁아 항상 꽉 채워지므로 증상이 없다). `w-full`로 width를
    // auto가 아닌 명시값(100%)으로 만들면 stretch 비활성 조건을 우회해 sibling과
    // 동일하게 max-w-5xl까지 채워진다.
    return (
        <>
            <JsonLd data={webPageJsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
                <SymbolPageHeading>
                    {displayName} {t('page.69d338')}
                </SymbolPageHeading>
                {/* 이전엔 이 자리에 sr-only 개요 섹션만 있었다(스크린리더 문맥 보강용,
                SEO 신호는 아니었다). 2026-08-19~2026-09-11 사이엔 index,follow
                라우트라 크롤러가 실제로 보는 유일한 본문 콘텐츠이기도 했지만,
                지금은 다시 항상 noindex라(generateMetadata 주석 참고) 색인 신호는
                아니고 방문자에게 심볼마다 달라지는 숫자(퍼센트·층수)를 보여주는
                일반 콘텐츠다 — 개인화 데이터(★평단/수익률)는 여전히 전혀
                포함하지 않는다(PositionCta만 그 CTA를 맡는다). range/currentPricePosition이
                degrade되면(bars 실패, high52w<=low52w 등) 섹션 자체를 생략한다. */}
                {range && currentPricePosition && (
                    <section
                        aria-labelledby="position-guide-heading"
                        className="space-y-3 rounded-lg border border-secondary-700 bg-secondary-800/30 p-5"
                    >
                        <h2
                            id="position-guide-heading"
                            className={HEADING_SECTION}
                        >
                            {displayName} {t('page.2ab959')}
                        </h2>
                        <p className="text-sm leading-relaxed text-secondary-400">
                            {/* 한 문장을 조각 6개로 쪼개면 한국어 어순에 고정된다 —
                                조사(`의`·`는`)가 앞 조각에 붙어 있어 영어·일본어로
                                옮길 자리가 없다. ICU 한 메시지로 둔다. */}
                            {t('page.positionRangeSentence', {
                                v0: displayName,
                                v1: formatAmountAligned(range.low52w, upper),
                                v2: formatAmountAligned(range.high52w, upper),
                                v3: formatAmountAligned(range.lastClose, upper),
                                v4: currentPricePosition.percentile,
                                v5: currentPricePosition.floorLabel,
                            })}{' '}
                            {currentPricePosition.tone}{' '}
                            {t('page.positionRegisterHint')}
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
        </>
    );
}
