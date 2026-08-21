import { getTranslations } from 'next-intl/server';
import { OptionsPageClient } from '@/widgets/options/OptionsPageClient';
import { setRequestLocale } from 'next-intl/server';
import { DEFAULT_LOCALE, isLocale } from '@/shared/i18n/locales';
import { getBlockedSymbolMetadata } from '@/app/[locale]/[symbol]/symbolIndexabilityMetadata';
import { SymbolPageHeading } from '@/views/symbol';
import {
    OptionsSnapshotProse,
    hasOptionsProse,
} from '@/views/symbol/snapshot/renderers/OptionsSnapshotProse';
import { OptionsEmptyState } from '@/widgets/options/OptionsEmptyState';
import { JsonLd } from '@/shared/ui/JsonLd';
import {
    SymbolRouteParams,
    isAdmissibleSymbolShape,
} from '@/shared/config/market';
import { isUnresolvableDegraded } from '@/shared/lib/symbolGuard';
import { getSeoSnapshotsStatic } from '@/entities/seo-snapshot/lib/getSnapshotStatic';
import {
    buildAssetAboutNode,
    buildDisplayName,
    pickAssetName,
    getAssetInfoResilient,
} from '@/entities/ticker';
import { mapExpirationsToSlots } from '@y0ngha/siglens-core';
import {
    fetchOptionsSnapshot,
    hasOptionsMarket,
} from '@/entities/options-chain/lib/optionsDataCache';
import { QUERY_KEYS, QUERY_STALE_TIME_MS } from '@/shared/config/queryConfig';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { SECONDS_PER_HALF_DAY } from '@/shared/config/time';
import {
    buildBreadcrumbJsonLd,
    buildSnapshotMetaDescription,
    buildSymbolOptionsSeoContent,
    buildSymbolSeoContent,
    buildWebPageJsonLd,
    symbolMetadataFromSeo,
    NOINDEX_SYMBOL_METADATA,
} from '@/shared/lib/seo';
import {
    dehydrate,
    HydrationBoundary,
    QueryClient,
} from '@tanstack/react-query';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isTabAllowedForSymbol } from '@/entities/ticker/api';

// 종목당 SEO 콘텐츠는 고정이고 동적 데이터는 클라가 재hydrate한다. 엣지 캐시로
// compute 호출을 줄인다. (일시 인프라 장애의 404 캐싱은 getAssetInfo strict로 차단)
export const revalidate = 43200; // 12h — SSR은 만기일뿐(Max Pain/IV/OI는 클라)

// generateStaticParams가 없으면 동적 라우트는 매 요청 동적 렌더돼 revalidate가
// 무력화된다(Next.js). 빈 배열 = 빌드 시 prebuild 없이, 첫 요청에 렌더+캐시 후
// revalidate 주기로 재생성하는 on-demand ISR. (cacheComponents 비활성이라 빈 배열 허용)
export async function generateStaticParams(): Promise<SymbolRouteParams[]> {
    return [];
}

interface Props {
    params: Promise<{ locale: string; symbol: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale: rawLocale, symbol } = await params;
    const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
    const upper = symbol.toUpperCase();
    // 본문 notFound()와 일관: 잘못된 ticker는 메타데이터를 비우고 noindex로 응답한다.
    if (!isAdmissibleSymbolShape(upper)) {
        return NOINDEX_SYMBOL_METADATA;
    }
    // 본문 `isTabAllowedForSymbol` 가드와 일관: 크립토 심볼은 options 탭이 없으므로
    // generateMetadata도 동일 조건에서 NOINDEX로 반환한다. 가드 없이 계속 진행하면
    // 본문은 notFound()(noindex)인데 메타데이터는 canonical + index:true인 soft-404가 만들어진다.
    if (!(await isTabAllowedForSymbol(upper, 'options'))) {
        return NOINDEX_SYMBOL_METADATA;
    }
    const [{ assetInfo, degraded }, hasOptions] = await Promise.all([
        getAssetInfoResilient(upper),
        // hasOptionsMarket는 Yahoo 인프라 실패 시 throw한다. getAssetInfoResilient와
        // 함께 Promise.all로 묶여 있어, 여기서 흡수하지 않으면 throw가 degraded 조기 반환
        // 전에 Promise.all을 reject시켜 generateMetadata가 ISR cold-gen에서 500을 낸다.
        // 옵션 시장 여부를 모르면 false(노출 안 함)로 degrade → noindex로 안전하게 처리한다.
        // (이 fetch는 staticSymbolCache로 감싸져 DSU를 throw하지 않고, DSU가 발생하더라도
        // 같은 Promise.all의 getAssetInfoResilient가 rethrow하므로 제어 흐름은 보존된다.)
        staticSymbolCache(
            ['options:has', upper],
            upper,
            () => hasOptionsMarket(upper),
            [],
            SECONDS_PER_HALF_DAY
        ).catch((e: unknown) => {
            console.error(
                '[generateMetadata:options] hasOptionsMarket infra failure, degrading to false:',
                e
            );
            return false;
        }),
    ]);
    const blockedMetadata = await getBlockedSymbolMetadata({
        locale,
        symbol: upper,
        assetInfo,
        degraded,
        revalidateSeconds: revalidate,
        tab: 'options',
    });
    if (blockedMetadata) return blockedMetadata;
    if (!assetInfo) return NOINDEX_SYMBOL_METADATA;

    const tSeo = await getTranslations({ locale, namespace: 'shared.seo' });
    const displayName = buildDisplayName(assetInfo, upper, locale);
    const seo = buildSymbolOptionsSeoContent(upper, tSeo, {
        displayName,
        koreanName: assetInfo.koreanName,
        englishName: assetInfo.name,
        locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
        hasOptions,
    });
    const metadata = symbolMetadataFromSeo(seo, locale);

    // snapshot-derived unique description (spec 2026-07-24 Task 8). Same
    // getSeoSnapshotsStatic(upper, revalidate) call the page body makes below —
    // unstable_cache dedupes it within this render, so this is a cache hit, not
    // an extra DB round-trip. Falls back to the templated description when no
    // snapshot exists (backward compatible). og/twitter keep the templated copy
    // — only the search-facing <meta name="description"> is overridden.
    const snap = (await getSeoSnapshotsStatic(upper, revalidate, locale)).find(
        s => s.tab === 'options'
    );
    const snapshotDescription = snap
        ? buildSnapshotMetaDescription(
              'options',
              snap.content,
              displayName,
              locale
          )
        : null;
    const description = snapshotDescription ?? metadata.description;

    // 옵션 없는 종목은 본문 OptionsEmptyState에서 sibling 분석 페이지
    // (차트/펀더멘털/뉴스 등)로 안내하므로, crawler가 그 internal link를
    // 따라갈 수 있도록 follow는 true를 유지한다. noindex이지만 follow:true는
    // "이 페이지는 색인 말고, 링크는 따라가라"는 정확한 의도 표현.
    return {
        ...metadata,
        description,
        ...(hasOptions ? {} : { robots: { index: false, follow: true } }),
    };
}

export default async function OptionsPage({ params }: Props) {
    const { locale, symbol } = await params;
    // DB 스냅샷은 로케일별 행이라 좁혀진 로케일이 필요하다. URL 세그먼트는 신뢰 경계다.
    const resolved = isLocale(locale) ? locale : DEFAULT_LOCALE;
    // 정적 렌더 활성화. 이 호출이 없으면 next-intl의 서버 API가 `headers()`로
    // 폴백해 **이 라우트의 ISR이 통째로 꺼진다**(빌드 route 표에서 `●` → `ƒ`).
    // 실측으로 확인했다 — Next 16.2는 `next/root-params` 미지원이라 이 경로가 유일하다.
    setRequestLocale(locale);
    const t = await getTranslations('app.symbol');
    const tSeo = await getTranslations('shared.seo');
    const upper = symbol.toUpperCase();

    if (!isAdmissibleSymbolShape(upper)) notFound();

    // Hard-404 crypto symbols before the hasOptionsMarket call — this tab is equity-only.
    if (!(await isTabAllowedForSymbol(upper, 'options'))) notFound();

    const [{ assetInfo, degraded }, hasOptions, snapshots] = await Promise.all([
        getAssetInfoResilient(upper),
        // ISR degrade guard: hasOptionsMarket는 Yahoo 인프라 실패 시 throw한다.
        // throw가 ISR 캐시에 0-byte 빈 결과를 굳히는 것을 막으려면 여기서 흡수해야 한다.
        // false로 degrade → 이미 존재하는 OptionsEmptyState 분기로 자연스럽게 빠진다.
        staticSymbolCache(
            ['options:has', upper],
            upper,
            () => hasOptionsMarket(upper),
            [],
            SECONDS_PER_HALF_DAY
        ).catch((e: unknown) => {
            console.error(
                '[OptionsPage] hasOptionsMarket failed, degrading to false:',
                e
            );
            return false;
        }),
        // ISR-safe (staticSymbolCache-wrapped, fail-open []) — see
        // getSeoSnapshotsStatic JSDoc. revalidateSeconds mirrors this page's
        // `export const revalidate` literal above.
        getSeoSnapshotsStatic(upper, revalidate, resolved),
    ]);
    const optionsSnapshot = snapshots.find(s => s.tab === 'options');
    // audit fix FIX 2: XOR 게이트 — 스냅샷 프로즈가 렌더 가능하면(hasOptionsProse)
    // 그것만 보여주고, 클라이언트 AI 위젯(OptionsAiAnalysis, OptionsPageClient
    // 내부)는 계속 마운트하되 `hideView`로 UI만 끈다 — 렌더 자체를 건너뛰면
    // `usePublishSymbolChat`이 돌지 않아 챗봇 컨텍스트가 빈다. 두 소스가 동일 필드(summary/perExpiration/
    // signals)를 같은 순서로 중복 렌더하던 문제(같은 결론을 사용자에게 두 번,
    // 스크린리더에 두 번, 중복 콘텐츠 SEO 리스크)를 해소한다.
    // `OverallSnapshotProse.hasOverallProse` 패턴과 동일 — narrowOptionsContent를
    // 재사용해 프로즈 컴포넌트와 동일 판단. audit fix FIX 9에서도 재사용된다
    // (OptionsEmptyState의 snapshotSlot을 truthy-element가 아닌 이 boolean으로
    // 게이팅).
    const showOptionsProse = hasOptionsProse(optionsSnapshot?.content);

    // degraded + digit-first 심볼 = 두 데이터 소스가 동시 다운 중이고 resolve 불가
    // → 차트 페이지와 동일한 notFound 처리로 sibling 일관성 유지.
    if (isUnresolvableDegraded(upper, degraded)) notFound();
    if (!assetInfo) notFound();

    const displayName = buildDisplayName(
        assetInfo,
        upper,
        isLocale(locale) ? locale : DEFAULT_LOCALE
    );

    // 옵션 시장이 없으면(또는 조회 실패로 degrade되면) OptionsEmptyState를 렌더한다.
    // 스냅샷이 있으면 이 분기에서도 프로즈를 유지한다(spec §7 — degraded 분기에서도
    // 스냅샷 유지). OptionsSnapshotProse 자체가 콘텐츠 없으면 null을 반환한다.
    if (!hasOptions) {
        return (
            <OptionsEmptyState
                symbol={upper}
                snapshotSlot={
                    showOptionsProse ? (
                        <OptionsSnapshotProse
                            content={optionsSnapshot?.content}
                            symbol={upper}
                            displayName={displayName}
                            // options 탭은 us-equity 전용이다(147행 notFound
                            // 가드) — OptionsSnapshotProseProps JSDoc 참고.
                            marketProfile="us-equity"
                            generatedAt={optionsSnapshot?.generatedAt}
                        />
                    ) : undefined
                }
            />
        );
    }

    // ISR degrade guard: fetchOptionsSnapshot는 Yahoo 인프라 실패 시 throw한다.
    // throw가 ISR 캐시에 0-byte 빈 결과를 굳히는 것을 막으려면 여기서 흡수해야 한다.
    // null로 degrade → 이미 존재하는 null 분기(OptionsEmptyState)로 자연스럽게 빠진다.
    const snapshot = await staticSymbolCache(
        ['options:snapshot', upper],
        upper,
        () => fetchOptionsSnapshot(upper),
        [],
        SECONDS_PER_HALF_DAY
    ).catch((e: unknown) => {
        console.error(
            '[OptionsPage] fetchOptionsSnapshot failed, degrading to null:',
            e
        );
        return null;
    });
    if (snapshot === null) {
        return (
            <OptionsEmptyState
                symbol={upper}
                snapshotSlot={
                    showOptionsProse ? (
                        <OptionsSnapshotProse
                            content={optionsSnapshot?.content}
                            symbol={upper}
                            displayName={displayName}
                            // options 탭은 us-equity 전용이다(147행 notFound
                            // 가드) — OptionsSnapshotProseProps JSDoc 참고.
                            marketProfile="us-equity"
                            generatedAt={optionsSnapshot?.generatedAt}
                        />
                    ) : undefined
                }
            />
        );
    }

    const expirations = snapshot.chains.map(c => c.expirationDate);
    const slots = mapExpirationsToSlots(expirations, new Date());

    const queryClient = new QueryClient({
        defaultOptions: { queries: { staleTime: QUERY_STALE_TIME_MS } },
    });
    // updatedAt 명시: RQ dehydrate 기본은 Date.now()라 매 ISR 재생성마다 다른 timestamp가
    // HTML에 박혀 ISR write churn 발생. snapshot의 capturedAt(provider 시점)로 고정 —
    // staticSymbolCache 윈도우 안에서는 동일 snapshot이라 capturedAt도 동일.
    const stableUpdatedAt = new Date(snapshot.capturedAt).getTime();
    queryClient.setQueryData(QUERY_KEYS.optionsSnapshot(upper), snapshot, {
        updatedAt: stableUpdatedAt,
    });

    // hasOptions: true 하드코딩은 의도적 — 위 OptionsEmptyState 분기(line 79, 83)를
    // 통과한 시점이라 옵션 시장이 존재함이 보장된다. generateMetadata와 달리 본문
    // 렌더 경로에서는 false 분기로 빠질 수 없으므로 재조회 없이 상수로 둔다.
    const { fullTitle, description, url } = buildSymbolOptionsSeoContent(
        upper,
        tSeo,
        {
            displayName,
            koreanName: assetInfo.koreanName,
            englishName: assetInfo.name,
            locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
            hasOptions: true,
        }
    );

    // about 노드는 stock으로 분류된 경우만 채워지고, ETF/Index/모호한 종목은
    // undefined로 자연 생략된다 (assetClassification 모듈 doc 참고).
    const aboutNode = buildAssetAboutNode(
        upper,
        pickAssetName(
            assetInfo,
            upper,
            isLocale(locale) ? locale : DEFAULT_LOCALE
        ),
        assetInfo.fmpSymbol
    );
    const jsonLd = buildWebPageJsonLd({
        url,
        name: fullTitle,
        description,
        about: aboutNode,
        locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
    });

    const breadcrumbJsonLd = buildBreadcrumbJsonLd(
        [
            { name: upper, url: buildSymbolSeoContent(upper, tSeo).url },
            { name: t('page.f1b01b'), url },
        ],
        isLocale(locale) ? locale : DEFAULT_LOCALE
    );

    const faqJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
            {
                '@type': 'Question',
                name: tSeo('faq.optionsScope', { v0: displayName }),
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: t('page.a32c23'),
                },
            },
            {
                '@type': 'Question',
                name: t('page.faa62c'),
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: t('page.e70f2d'),
                },
            },
            {
                '@type': 'Question',
                name: t('page.ec648e'),
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: t('page.f865a7'),
                },
            },
        ],
    };

    return (
        <>
            <JsonLd data={jsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <JsonLd data={faqJsonLd} />
            {/* main 랜드마크: 다른 5개 sibling 페이지와 일관성. options-empty
                상태(OptionsEmptyState)는 자체적으로 <main>을 가지지만, 옵션
                데이터가 있는 정상 path도 동일하게 main으로 감싸야 sibling 일관성
                과 a11y landmark navigation이 유지된다. */}
            {/* audit fix FIX 3: space-y-6 added — all 6 sibling pages have it,
                and its absence left the h1 flush against the snapshot card
                below. (The redundant `mx-auto max-w-5xl px-4` that
                OptionsPageClient used to re-apply internally is removed there
                — see OptionsPageClient.tsx — so this <main>'s max-width is the
                single source and the snapshot card no longer reads ~32px wider
                than the cards beneath it.) */}
            <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
                <SymbolPageHeading>
                    {t('page.ba2808', { v0: displayName })}
                </SymbolPageHeading>
                <section className="sr-only">
                    <h2>{t('page.c3a35c', { v0: displayName })}</h2>
                    <p>{t('page.c7925a', { v0: displayName })}</p>
                    {expirations.length > 0 ? (
                        <p>
                            {t('page.29ae1a', {
                                v0: expirations.length,
                                v1: expirations[0],
                            })}
                        </p>
                    ) : null}
                </section>
                {/* audit fix FIX 2: XOR — OptionsAiAnalysis (client widget,
                    inside OptionsPageClient below) and OptionsSnapshotProse
                    both render the same AI conclusion (summary/perExpiration/
                    signals). Showing both duplicated the text for sighted
                    users and screen readers and doubled as a duplicate-content
                    SEO risk. OptionsAiAnalysis fetches its analysis via a
                    client-side hook — during ISR generation it bakes its
                    loading skeleton into the static HTML (no crawlable AI
                    text) until it hydrates — so this prose covers crawlers
                    either way; `hasSnapshotProse` (below) additionally tells
                    OptionsPageClient to skip mounting the widget when this
                    prose is already showing the same content. Renders null
                    when no snapshot exists (spec 2026-07-24 Task 7b). */}
                <OptionsSnapshotProse
                    content={optionsSnapshot?.content}
                    symbol={upper}
                    displayName={displayName}
                    // options 탭은 us-equity 전용이다(147행 notFound 가드) —
                    // OptionsSnapshotProseProps JSDoc 참고.
                    marketProfile="us-equity"
                    generatedAt={optionsSnapshot?.generatedAt}
                />
                <HydrationBoundary state={dehydrate(queryClient)}>
                    <OptionsPageClient
                        symbol={upper}
                        companyName={displayName}
                        snapshot={snapshot}
                        slots={slots}
                        hasSnapshotProse={showOptionsProse}
                    />
                </HydrationBoundary>
            </main>
        </>
    );
}
