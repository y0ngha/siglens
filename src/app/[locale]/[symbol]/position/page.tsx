import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { buildSymbolTabBreadcrumbJsonLd } from '@/app/[locale]/[symbol]/_lib/symbolTabBreadcrumb';
import {
    enterSymbolTabMetadata,
    enterSymbolTabPage,
    type SymbolTabParams,
} from '@/app/[locale]/[symbol]/_lib/symbolTabEntry';
import { requireResolvableAsset } from '@/app/[locale]/[symbol]/requireResolvableAsset';
import { getBlockedSymbolMetadata } from '@/app/[locale]/[symbol]/symbolIndexabilityMetadata';
import { buildSymbolWebPageJsonLd } from '@/app/[locale]/[symbol]/symbolWebPageJsonLd';
import { isTabAllowedForSymbol } from '@/entities/ticker/api';
import { buildAssetAboutNode } from '@/entities/ticker/lib/assetClassification';
import { buildDisplayName, pickAssetName } from '@/entities/ticker/lib/ticker';
import { SymbolRouteParams } from '@/shared/config/market';
import {
    getDescriptor,
    marketProfileOf,
} from '@/shared/config/marketProfile/registry';
import { cn } from '@/shared/lib/cn';
import { buildSymbolPositionSeoContent } from '@/shared/lib/seoSymbol';
import { NOINDEX_SYMBOL_METADATA } from '@/shared/lib/seo';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { symbolMetadataFromSeo } from '@/shared/lib/symbolMetadata';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { JsonLd } from '@/shared/ui/JsonLd';
import { SymbolPageHeading } from '@/views/symbol/ui/SymbolPageHeading';
import { formatAmountAligned } from '@/widgets/portfolio-position/utils/buildingPriceFormat';
import { PositionTabContent } from '@/widgets/portfolio-position/ui/PositionTabContent';

import {
    resolveCurrentPricePosition,
    resolvePriceRange,
} from './_lib/pricePosition';

/**
 * ISR 상한. "내 위치"가 SSR로 내리는 것은 느리게 변하는 최근 가격 범위(52주 저·고점·종가)뿐이고,
 * 평단·수익률은 클라(하이드레이션 + 회원 게이트)라 SSR 신선도와 무관하다.
 */
export const revalidate = 43200; // 12h

/**
 * 빈 배열 = 빌드 시 prebuild 없이 첫 요청에 렌더+캐시하는 on-demand ISR. 없으면 동적 세그먼트가
 * 매 요청 동적 렌더돼 `revalidate`가 무력화된다.
 */
export async function generateStaticParams(): Promise<SymbolRouteParams[]> {
    return [];
}

interface Props {
    params: SymbolTabParams;
}

/**
 * "내 위치" 탭 메타데이터 — **항상 noindex**. SSR 고유 텍스트가 형제 탭의 1/3 이하이고 그 전부가
 * 52주 범위 밴드 + 층 라벨이라는 템플릿 문장이며, 페이지의 본체(평단·수익률)는 로그인 후 클라에서만
 * 그려진다. 공유 카드용 훅 카피(title·OG·Twitter)는 유지하고 robots만 덮는다 — canonical은
 * `symbolMetadataFromSeo`의 self-canonical 그대로다.
 *
 * 탭이 없는 종목은 본문과 같은 판정으로 메타데이터 단계에서도(차단 메타보다 먼저) 404다. 지금은 모든
 * market profile이 이 탭을 지원하지만, 미지원 프로필이 생겨도 404 응답에 탭 카피가 얹히지 않게 둔다.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const {
        locale,
        ticker: upper,
        tSeo,
        assetInfo,
        degraded,
    } = await enterSymbolTabMetadata(params);
    if (!(await isTabAllowedForSymbol(upper, 'position'))) notFound();
    const blockedMetadata = await getBlockedSymbolMetadata({
        locale,
        symbol: upper,
        assetInfo,
        degraded,
        revalidateSeconds: revalidate,
        // 탭 카피를 쓴다 — 없으면 차단된 position 페이지가 차트 탭과 같은 title·description을 내
        // 한 종목에 중복 문서가 둘 생긴다.
        tab: 'position',
    });
    if (blockedMetadata) return blockedMetadata;
    const displayName = buildDisplayName(assetInfo, upper, locale);
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

/**
 * "내 위치" 탭 본문 — 현재가의 52주 범위 내 위치 가이드(공개 데이터) + 클라 전용 회원 영역
 * (`PositionTabContent`). SSR에는 개인화 데이터(평단·수익률)가 전혀 들어가지 않는다.
 *
 * `WebPage`·`BreadcrumbList`는 noindex여도 페이지 정체성 선언으로 싣는다. FAQPage는 넣지 않는다 —
 * 리치 결과 표시 이득이 없고, 수백 종목에 같은 문답을 복제하면 이미 얇은 이 탭을 더 얇게 만든다.
 */
export default async function PositionPage({ params }: Props) {
    const { locale, ticker: upper } = await enterSymbolTabPage(params);
    // 번역과 존재 판정은 서로 독립이다(존재하지 않으면 `notFound()`로 함께 끊긴다).
    const [t, tSeo, { assetInfo }] = await Promise.all([
        getTranslations('app.symbol'),
        getTranslations('shared.seo'),
        requireResolvableAsset(upper),
    ]);
    if (!(await isTabAllowedForSymbol(upper, 'position'))) notFound();

    const displayName = buildDisplayName(assetInfo, upper, locale);
    const marketProfile = marketProfileOf(assetInfo);

    const seo = buildSymbolPositionSeoContent(upper, tSeo, {
        displayName,
        koreanName: assetInfo.koreanName,
    });
    const webPageJsonLd = buildSymbolWebPageJsonLd({
        url: seo.url,
        name: seo.fullTitle,
        description: seo.description,
        // 형제 탭과 같은 로케일별 이름 — 비기본 로케일은 영문 법인명이다.
        about: buildAssetAboutNode(
            upper,
            pickAssetName(assetInfo, upper, locale),
            assetInfo.fmpSymbol,
            getDescriptor(marketProfile).assetClass
        ),
        locale,
    });
    // range가 degrade되면(봉 실패 등) null이고, 퇴화 입력(high52w <= low52w)이면
    // resolveCurrentPricePosition이 null이다 — 어느 쪽이든 가이드 문단을 생략한다.
    const [breadcrumbJsonLd, range, tPos, tBand] = await Promise.all([
        buildSymbolTabBreadcrumbJsonLd({
            ticker: upper,
            displayName,
            tab: 'position',
            tabUrl: seo.url,
            tSeo,
            locale,
        }),
        resolvePriceRange(upper, assetInfo.fmpSymbol, marketProfile),
        getTranslations('widgets.portfolio-position.positionNote'),
        getTranslations('app.symbol.position.band'),
    ]);
    const currentPricePosition = range
        ? resolveCurrentPricePosition(range, tPos, tBand)
        : null;

    // <main>의 `w-full`은 필수다. 이 <main>은 SymbolLayoutJail(`flex flex-col`)의 직계 flex item이라
    // `mx-auto`(양쪽 auto margin)가 cross-axis stretch를 끈다 — 폭이 max-w-5xl까지 차지 않고 콘텐츠 폭으로
    // 줄어, CTA 카드 하나뿐인 상태(비회원·미보유)에서 heading까지 화면 중앙에 떠 보인다.
    return (
        <>
            <JsonLd data={webPageJsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
                <SymbolPageHeading>
                    {displayName} {t('page.69d338')}
                </SymbolPageHeading>
                {range && currentPricePosition && (
                    <section
                        aria-labelledby="position-guide-heading"
                        className={cn(SURFACE_CARD, 'space-y-3 p-5')}
                    >
                        <h2
                            id="position-guide-heading"
                            className={HEADING_SECTION}
                        >
                            {t('page.positionGuideHeading', {
                                v0: displayName,
                            })}
                        </h2>
                        <p className="text-sm leading-relaxed text-secondary-400">
                            {/* 한 문장을 조각으로 쪼개면 한국어 어순에 고정된다 — 조사가 앞 조각에 붙어
                                영어·일본어로 옮길 자리가 없다. ICU 한 메시지로 둔다. */}
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
