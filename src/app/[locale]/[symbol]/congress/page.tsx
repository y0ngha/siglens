import { getTranslations } from 'next-intl/server';
import { getCongressPageData } from '@/app/[locale]/[symbol]/congress/congressData';
import { setRequestLocale } from 'next-intl/server';
import { DEFAULT_LOCALE, isLocale } from '@/shared/i18n/locales';
import { getBlockedSymbolMetadata } from '@/app/[locale]/[symbol]/symbolIndexabilityMetadata';
import { getCongressTradesResilient } from '@/entities/congress-trades';
import { getProfileResilient } from '@/app/[locale]/[symbol]/fundamental/getProfileResilient';
import { CongressDegraded } from '@/app/[locale]/[symbol]/congress/CongressDegraded';
import { CongressTradesTable, CongressTrendSummary } from '@/widgets/congress';
import { SymbolPageHeading } from '@/views/symbol';
import {
    CongressSnapshotProse,
    hasCongressProse,
} from '@/views/symbol/snapshot/renderers/CongressSnapshotProse';
import { CrossLinkCards } from '@/shared/ui/CrossLinkCards';
import { JsonLd } from '@/shared/ui/JsonLd';
import {
    isAdmissibleSymbolShape,
    type SymbolRouteParams,
} from '@/shared/config/market';
import { isUnresolvableDegraded } from '@/shared/lib/symbolGuard';
import { getSeoSnapshotsStatic } from '@/entities/seo-snapshot/lib/getSnapshotStatic';
import {
    buildAssetAboutNode,
    buildDisplayName,
    getAssetInfoResilient,
} from '@/entities/ticker';
import {
    buildBreadcrumbJsonLd,
    buildSnapshotMetaDescription,
    buildSymbolCongressSeoContent,
    buildSymbolSeoContent,
    buildSymbolWebPageJsonLd,
    symbolMetadataFromSeo,
    NOINDEX_SYMBOL_METADATA,
} from '@/shared/lib/seo';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { isTabAllowedForSymbol } from '@/entities/ticker/api';

// 의회 거래는 STOCK Act상 신고 마감(거래일 +30~45일) 이후 공시되므로
// 일 단위 갱신이 적절하다. 24h revalidate는 엣지 캐시를 최대한 활용하면서
// 새 공시를 다음 날 안에 반영하는 균형점이다.
// app/CLAUDE.md ISR 4축 규약 §4: route segment config must stay a literal for Next.js static analysis (the magic-number-extraction rule does not apply here).
export const revalidate = 86400; // 24h

// generateStaticParams가 없으면 revalidate가 무력화된다(Next.js). 빈 배열 = 빌드 시 prebuild
// 없이, 첫 요청에 렌더+캐시 후 revalidate 주기로 재생성하는 on-demand ISR.
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
    // 본문 `isTabAllowedForSymbol` 가드와 일관: 크립토 심볼은 congress 탭이 없으므로
    // generateMetadata도 동일 조건에서 NOINDEX로 반환한다. 가드 없이 계속 진행하면
    // 본문은 notFound()(noindex)인데 메타데이터는 canonical + index:true인 soft-404가 만들어진다.
    if (!(await isTabAllowedForSymbol(upper, 'congress'))) {
        return NOINDEX_SYMBOL_METADATA;
    }
    const { assetInfo, degraded } = await getAssetInfoResilient(upper);
    const blockedMetadata = await getBlockedSymbolMetadata({
        locale,
        symbol: upper,
        assetInfo,
        degraded,
        revalidateSeconds: revalidate,
        tab: 'congress',
    });
    if (blockedMetadata) return blockedMetadata;

    // 의회 거래 페이지는 종목이 실존해야 의미가 있다 — fundamental/financials와
    // 동일한 profile 게이트로 존재성을 확인한다(같은 요청 내 React.cache + unstable_cache
    // 공유라 추가 FMP round-trip 없음). 본문과 메타의 source-of-truth가 일치한다:
    //   - profileDegraded(FMP 인프라 실패) → 본문은 degrade(200)를 렌더하므로 noindex.
    //   - profile === null(실존하지 않는 종목) → 본문은 notFound()이므로 noindex.
    const { profile, degraded: profileDegraded } =
        await getProfileResilient(upper);
    if (profileDegraded || profile === null) {
        return NOINDEX_SYMBOL_METADATA;
    }
    // **financials와의 의도적 차이점**: 0건은 정상(sparse 종목)이라 색인 가능.
    // `degraded === true`(FMP 인프라 실패)만 noindex로 떨어뜨린다.
    // getCongressTradesResilient는 React.cache로 메모이즈되므로 본문과 동일한 호출이 즉시 반환된다.
    const { degraded: tradesDegraded } =
        await getCongressTradesResilient(upper);
    if (tradesDegraded) {
        return NOINDEX_SYMBOL_METADATA;
    }
    const displayName = assetInfo ? buildDisplayName(assetInfo, upper) : upper;
    const seo = buildSymbolCongressSeoContent(upper, {
        displayName,
        koreanName: assetInfo?.koreanName,
    });
    const metadata = symbolMetadataFromSeo(seo, locale);

    // snapshot-derived unique description (spec 2026-07-24 Task 8). Same
    // getSeoSnapshotsStatic(upper, revalidate) call the page body makes below —
    // unstable_cache dedupes it within this render, so this is a cache hit, not
    // an extra DB round-trip. Falls back to the templated description when no
    // snapshot exists (backward compatible). og/twitter keep the templated copy
    // — only the search-facing <meta name="description"> is overridden.
    const snap = (await getSeoSnapshotsStatic(upper, revalidate)).find(
        s => s.tab === 'congress'
    );
    const snapshotDescription = snap
        ? buildSnapshotMetaDescription('congress', snap.content, displayName)
        : null;
    return snapshotDescription
        ? { ...metadata, description: snapshotDescription }
        : metadata;
}

export default async function CongressPage({ params }: Props) {
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

    // Hard-404 crypto symbols — this tab is equity-only.
    if (!(await isTabAllowedForSymbol(upper, 'congress'))) notFound();

    // getProfileResilient uses ['fundamental:profile', upper] key, shared with
    // ProfileSection inside the fundamental page, so there is no extra FMP round-trip.
    // snapshots: ISR-safe (staticSymbolCache-wrapped, fail-open []) — see
    // getSeoSnapshotsStatic JSDoc. revalidateSeconds mirrors this page's
    // `export const revalidate` literal above.
    const [
        { profile, degraded: profileDegraded },
        { assetInfo, degraded },
        snapshots,
    ] = await Promise.all([
        getProfileResilient(upper),
        getAssetInfoResilient(upper),
        getSeoSnapshotsStatic(upper, revalidate),
    ]);
    const congressSnapshot = snapshots.find(s => s.tab === 'congress');
    // audit fix FIX 2: XOR 게이트 — 스냅샷 프로즈가 렌더 가능하면(hasCongressProse)
    // 그것만 보여준다. 클라이언트 AI 위젯은 계속 마운트하되 `hideView`로 UI만 끈다 —
    // 위젯을 아예 렌더하지 않으면 `usePublishSymbolChat`이 돌지 않아 챗봇의 분석
    // 컨텍스트가 비어 입력이 잠긴다(스냅샷이 있을수록 챗이 막히는 역전).
    // 두 소스가 동일 필드(summaryKo/notableMembersKo/riskNoteKo)를 같은 순서로
    // 중복 렌더하던 문제(같은 결론을 사용자에게 두 번, 스크린리더에 두 번, 중복
    // 콘텐츠 SEO 리스크)를 해소한다. `OverallSnapshotProse.hasOverallProse` 패턴과
    // 동일 — narrowCongressContent를 재사용해 프로즈 컴포넌트와 동일 판단.
    const showCongressProse = hasCongressProse(congressSnapshot?.content);

    // degraded + digit-first 심볼 = crypto_assets DB와 FMP가 동시 다운 중이고 resolve 불가
    // → 차트 페이지와 동일한 notFound 처리로 sibling 일관성 유지.
    if (isUnresolvableDegraded(upper, degraded)) notFound();

    // assetInfo degraded → generateMetadata returns NOINDEX_SYMBOL_METADATA (above),
    // while the page body renders a 200 with `displayName = upper` as ticker fallback.
    // This mirrors the financials/fundamental pages: a soft-200 keeps the user-facing
    // page navigable while noindex prevents stale/degraded content from being indexed.
    const displayName = assetInfo ? buildDisplayName(assetInfo, upper) : upper;

    // FMP 인프라 일시 실패: 500 대신 degrade 안내(200)를 렌더한다. 다음 revalidate에
    // 인프라가 복구되면 정상 데이터로 자동 갱신된다. 스냅샷이 있으면 degrade 중에도
    // 크롤러에게 프로즈 콘텐츠를 보여준다(spec §7 — degraded 분기에서도 스냅샷 유지).
    if (profileDegraded) {
        return (
            <CongressDegraded
                displayName={displayName}
                symbol={upper}
                snapshotContent={congressSnapshot?.content}
                snapshotGeneratedAt={congressSnapshot?.generatedAt}
            />
        );
    }

    // profile === null = FMP 200 + 빈 결과 = 실존하지 않는 종목 → 404.
    if (profile === null) {
        notFound();
    }

    // `degraded` semantically differs from financials: ONLY FMP infra failure
    // is degrade. `trades.length === 0` is a normal indexable state — sparse
    // tickers legitimately have no congress trades on record.
    const { trades, degraded: tradesDegraded } =
        await getCongressPageData(upper);

    if (tradesDegraded) {
        return (
            <CongressDegraded
                displayName={displayName}
                symbol={upper}
                snapshotContent={congressSnapshot?.content}
                snapshotGeneratedAt={congressSnapshot?.generatedAt}
            />
        );
    }

    const { fullTitle, description, url } = buildSymbolCongressSeoContent(
        upper,
        {
            displayName,
            koreanName: assetInfo?.koreanName,
        }
    );

    // about 노드는 stock으로 분류된 경우만 채워지고, ETF/Index/모호한 종목은
    // undefined로 자연 생략된다.
    const aboutNode = buildAssetAboutNode(
        upper,
        assetInfo?.koreanName ?? assetInfo?.name ?? upper,
        assetInfo?.fmpSymbol
    );

    const jsonLd = buildSymbolWebPageJsonLd({
        url,
        name: fullTitle,
        description,
        about: aboutNode,
    });

    const breadcrumbJsonLd = buildBreadcrumbJsonLd([
        { name: upper, url: buildSymbolSeoContent(upper).url },
        { name: t('page.7b06ac'), url },
    ]);

    const faqJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
            {
                '@type': 'Question',
                name: `${displayName}의 의회 거래는 어떤 의미가 있나요?`,
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: t('page.1a9e0a'),
                },
            },
            {
                '@type': 'Question',
                name: t('page.72cf41'),
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: t('page.a916d9'),
                },
            },
            {
                '@type': 'Question',
                name: `${displayName}의 의회 거래가 매수 신호인가요?`,
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: t('page.2c1d31'),
                },
            },
        ],
    };

    return (
        <>
            <JsonLd data={jsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <JsonLd data={faqJsonLd} />
            <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
                <SymbolPageHeading>
                    {t('page.e607c1', { v0: displayName })}
                </SymbolPageHeading>
                <section className="sr-only">
                    <h2>{t('page.1af282', { v0: displayName })}</h2>
                    <p>{t('page.42ddbe', { v0: displayName })}</p>
                </section>

                {/* audit fix FIX 2: XOR — CongressTrendSummary (client widget) and
                    CongressSnapshotProse (SSR prose) both render the same AI
                    conclusion (summaryKo/notableMembersKo/riskNoteKo). Showing
                    both duplicated the text for sighted users and screen readers
                    and doubled as a duplicate-content SEO risk. When the snapshot
                    is renderable, show the prose only; the widget stays mounted
                    with `hideView` so it keeps publishing chat context, and
                    renders its own view only when no snapshot exists —
                    CongressTrendSummary is a client component that fetches its
                    analysis via a client-side hook, so during ISR generation it
                    bakes its loading skeleton into the static HTML (no crawlable
                    AI text) until it hydrates. */}
                {showCongressProse && (
                    <CongressSnapshotProse
                        content={congressSnapshot?.content}
                        symbol={upper}
                        displayName={displayName}
                        // congress 탭은 us-equity 전용이다 —
                        // CongressSnapshotProseProps JSDoc 참고.
                        marketProfile="us-equity"
                        generatedAt={congressSnapshot?.generatedAt}
                    />
                )}
                <CongressTrendSummary
                    symbol={upper}
                    hideView={showCongressProse}
                />

                <CongressTradesTable trades={trades} />

                <CrossLinkCards symbol={upper} current="congress" />
            </main>
        </>
    );
}
