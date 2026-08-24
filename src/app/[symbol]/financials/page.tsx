import { getFinancialsPageData } from '@/app/[symbol]/financials/financialData';
import { getBlockedSymbolMetadata } from '@/app/[symbol]/symbolIndexabilityMetadata';
import {
    getFinancialsSnapshot,
    isEmptyFinancialsSnapshot,
} from '@/entities/financials-statements';
import { getProfileResilient } from '@/app/[symbol]/fundamental/getProfileResilient';
import { FinancialsDegraded } from '@/app/[symbol]/financials/FinancialsDegraded';
import { FinancialsAiSummary } from '@/widgets/financials/FinancialsAiSummary';
import { FinancialsScorecard } from '@/widgets/financials/FinancialsScorecard';
import { statementCurrencyOf } from '@/widgets/financials/utils/numberFormat';
import { FinancialsStatements } from '@/widgets/financials/FinancialsStatements';
import { SymbolPageHeading } from '@/views/symbol';
import {
    FinancialsSnapshotProse,
    hasFinancialsProse,
} from '@/views/symbol/snapshot/renderers/FinancialsSnapshotProse';
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
    buildSymbolFinancialsSeoContent,
    buildSymbolSeoContent,
    buildSymbolWebPageJsonLd,
    symbolMetadataFromSeo,
    NOINDEX_SYMBOL_METADATA,
    noindexSymbolMetadata,
} from '@/shared/lib/seo';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { isTabAllowedForSymbol } from '@/entities/ticker/api';
import {
    marketProfileOf,
    profileIdForSymbol,
    type MarketProfileId,
} from '@/shared/config/marketProfile';

// 종목당 재무제표는 분기(약 45일) 단위로 갱신된다. 24h revalidate는 엣지 캐시를 최대한 활용하면서
// 다음 분기 공시 이전에 오래된 데이터를 서빙하지 않는 균형점이다.
// app/CLAUDE.md ISR 4축 규약 §4: route segment config must stay a literal for Next.js static analysis (the magic-number-extraction rule does not apply here).
export const revalidate = 86400; // 24h

// generateStaticParams가 없으면 revalidate가 무력화된다(Next.js). 빈 배열 = 빌드 시 prebuild
// 없이, 첫 요청에 렌더+캐시 후 revalidate 주기로 재생성하는 on-demand ISR.
export async function generateStaticParams(): Promise<SymbolRouteParams[]> {
    return [];
}

interface Props {
    params: Promise<{ symbol: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { symbol } = await params;
    const upper = symbol.toUpperCase();
    // 본문 notFound()와 일관: 잘못된 ticker는 메타데이터를 비우고 noindex로 응답한다.
    if (!isAdmissibleSymbolShape(upper)) {
        return NOINDEX_SYMBOL_METADATA;
    }
    // 본문 `isTabAllowedForSymbol` 가드와 일관: 크립토 심볼은 financials 탭이 없으므로
    // generateMetadata도 동일 조건에서 NOINDEX로 반환한다. 가드 없이 계속 진행하면
    // 본문은 notFound()(noindex)인데 메타데이터는 canonical + index:true인 soft-404가 만들어진다.
    if (!(await isTabAllowedForSymbol(upper, 'financials'))) {
        return noindexSymbolMetadata(upper);
    }
    const { assetInfo, degraded } = await getAssetInfoResilient(upper);
    const blockedMetadata = await getBlockedSymbolMetadata({
        symbol: upper,
        assetInfo,
        degraded,
        revalidateSeconds: revalidate,
        tab: 'financials',
    });
    if (blockedMetadata) return blockedMetadata;

    // 재무제표 페이지는 FMP profile이 있어야 렌더된다. profile을 본문/ProfileSection과
    // 동일한 정적 캐시 키로 미리 확인한다(같은 요청 내 React.cache + unstable_cache 공유라
    // 추가 FMP round-trip 없음). 그래서 본문 렌더 결과와 metadata noindex 판단이 일치한다:
    //   - profileDegraded(FMP 인프라 실패) → 본문은 degrade(200)를 렌더하므로 noindex.
    //   - profile === null(실존하지 않는 종목) → 본문은 notFound()이므로 noindex.
    // `displayName`을 가드보다 위에서 계산한다 — 아래 noindex 분기들도
    // `noindexSymbolMetadata`에 넘겨야 차단된 페이지가 티커가 아니라 사명까지
    // 담은 title/description을 갖는다. `buildDisplayName`은 순수 함수라 위치를
    // 올려도 부작용이 없다.
    const displayName = assetInfo ? buildDisplayName(assetInfo, upper) : upper;
    const noindexOpts = { displayName, koreanName: assetInfo?.koreanName };

    const { profile, degraded: profileDegraded } =
        await getProfileResilient(upper);
    if (profileDegraded || profile === null) {
        return noindexSymbolMetadata(upper, noindexOpts);
    }
    // profile은 있으나 6종 재무 fetch가 모두 비면(FMP 일시 장애 등) 본문은 degrade를
    // 렌더하므로(아래 default export 참조) 메타도 noindex로 일치시킨다.
    // getFinancialsSnapshot은 React.cache로 감싸 per-request 메모이즈되므로,
    // generateMetadata와 페이지 렌더가 같은 인자로 호출하면 두 번째는 즉시 반환된다
    // (빈 스냅샷 경로처럼 cacheNonEmpty가 Next 캐싱을 우회해도 재실행 없음). cross-request
    // 정적화는 staticSymbolCache(unstable_cache), 빈 경로의 cross-request dedup은 Redis가 담당.
    const snapshot = await getFinancialsSnapshot(upper);
    if (isEmptyFinancialsSnapshot(snapshot)) {
        return noindexSymbolMetadata(upper, noindexOpts);
    }
    const seo = buildSymbolFinancialsSeoContent(upper, {
        displayName,
        koreanName: assetInfo?.koreanName,
    });
    const metadata = symbolMetadataFromSeo(seo);

    // snapshot-derived unique description (spec 2026-07-24 Task 8). Same
    // getSeoSnapshotsStatic(upper, revalidate) call the page body makes below —
    // unstable_cache dedupes it within this render, so this is a cache hit, not
    // an extra DB round-trip. Falls back to the templated description when no
    // snapshot exists (backward compatible). og/twitter keep the templated copy
    // — only the search-facing <meta name="description"> is overridden.
    const snap = (await getSeoSnapshotsStatic(upper, revalidate)).find(
        s => s.tab === 'financials'
    );
    const snapshotDescription = snap
        ? buildSnapshotMetaDescription('financials', snap.content, displayName)
        : null;
    return snapshotDescription
        ? { ...metadata, description: snapshotDescription }
        : metadata;
}

export default async function FinancialsPage({ params }: Props) {
    const { symbol } = await params;
    const upper = symbol.toUpperCase();

    if (!isAdmissibleSymbolShape(upper)) {
        notFound();
    }

    // Hard-404 crypto symbols — this tab is equity-only.
    if (!(await isTabAllowedForSymbol(upper, 'financials'))) notFound();

    // Gate via profile — same pattern as the fundamental page.
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
    const financialsSnapshot = snapshots.find(s => s.tab === 'financials');
    // audit fix FIX 2: XOR 게이트 — 스냅샷 프로즈가 렌더 가능하면(hasFinancialsProse)
    // 그것만 보여준다. 클라이언트 AI 위젯은 계속 마운트하되 `hideView`로 UI만 끈다 —
    // 위젯을 아예 렌더하지 않으면 `usePublishSymbolChat`이 돌지 않아 챗봇의 분석
    // 컨텍스트가 비어 입력이 잠긴다(스냅샷이 있을수록 챗이 막히는 역전).
    // 두 소스가 동일 필드(overallConclusionKo/axisAssessments/riskFactorsKo)를
    // 같은 순서로 중복 렌더하던 문제(같은 결론을 사용자에게 두 번, 스크린리더에
    // 두 번, 중복 콘텐츠 SEO 리스크)를 해소한다. `OverallSnapshotProse
    // .hasOverallProse` 패턴과 동일 — narrowFinancialsContent를 재사용해 프로즈
    // 컴포넌트와 동일 판단.
    const showFinancialsProse = hasFinancialsProse(financialsSnapshot?.content);

    // degraded + digit-first 심볼 = crypto_assets DB와 FMP가 동시 다운 중이고 resolve 불가
    // → 차트 페이지와 동일한 notFound 처리로 sibling 일관성 유지.
    if (isUnresolvableDegraded(upper, degraded)) notFound();

    const displayName = assetInfo ? buildDisplayName(assetInfo, upper) : upper;
    // CrossLinkCards에 넘길 시장 프로필. financials도 fundamental과 동일하게
    // assetInfo가 optional이라(FMP profile만 있어도 렌더) marketProfileOf(assetInfo)를
    // 못 쓸 수 있다 — 그 경우 심볼 형상으로 판정한다(`profileIdForSymbol`, marketProfileOf
    // 내부 fallback과 동일 패턴). crypto는 isTabAllowedForSymbol('financials') 가드로
    // 이미 걸러졌으므로 여기 남는 값은 us-equity/kr-equity뿐이다. SEO 감사(2026-08-18):
    // 이 값을 넘기지 않으면 CrossLinkCards의 `marketProfile='us-equity'` 기본값으로
    // 떨어져, 한국 종목 페이지에도 존재하지 않는 `/options`·`/congress` 링크가 노출됐다.
    const marketProfile: MarketProfileId = assetInfo
        ? marketProfileOf(assetInfo)
        : profileIdForSymbol(upper);

    // FMP 인프라 일시 실패: 500 대신 degrade 안내(200)를 렌더한다. 다음 revalidate에
    // 인프라가 복구되면 정상 데이터로 자동 갱신된다. 스냅샷이 있으면 degrade 중에도
    // 크롤러에게 프로즈 콘텐츠를 보여준다(spec §7 — degraded 분기에서도 스냅샷 유지).
    if (profileDegraded) {
        return (
            <FinancialsDegraded
                displayName={displayName}
                symbol={upper}
                marketProfile={marketProfile}
                snapshotContent={financialsSnapshot?.content}
                snapshotGeneratedAt={financialsSnapshot?.generatedAt}
            />
        );
    }

    // profile === null = FMP 200 + 빈 결과 = 실존하지 않는 종목 → 404.
    if (profile === null) {
        notFound();
    }

    // Fetch the annual snapshot + scorecard in a single call.
    const { snapshot, scorecard } = await getFinancialsPageData(upper);

    // profile은 정상이나 6종 재무 fetch가 모두 비면(FMP 일시 장애) scorecard가 전 축 F로
    // 오인 렌더되고 색인된다. all-empty면 degrade UI로 전환하고(메타도 noindex로 일치),
    // 다음 revalidate에 데이터가 복구되면 자동 정상화된다. 스냅샷이 있으면 이 분기에서도 유지.
    if (isEmptyFinancialsSnapshot(snapshot)) {
        return (
            <FinancialsDegraded
                displayName={displayName}
                symbol={upper}
                marketProfile={marketProfile}
                snapshotContent={financialsSnapshot?.content}
                snapshotGeneratedAt={financialsSnapshot?.generatedAt}
            />
        );
    }

    const { fullTitle, description, url } = buildSymbolFinancialsSeoContent(
        upper,
        {
            displayName,
            koreanName: assetInfo?.koreanName,
        }
    );

    // about 노드는 stock으로 분류된 경우만 채워지고, ETF/Index/모호한 종목은
    // undefined로 자연 생략된다. financials 페이지도 fundamental과 동일하게 assetInfo가
    // optional이라 ticker를 fallback name으로 사용한다.
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
        { name: '재무제표', url },
    ]);

    const faqJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
            {
                '@type': 'Question',
                name: `${displayName}의 재무는 건전한가요?`,
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: '안정성 점수는 부채비율과 유동비율을 기반으로 산출됩니다. 점수가 높을수록 부채 부담이 낮고 단기 상환 능력이 우수하다는 신호입니다. 재무상태표의 총자산 대비 총부채 비율도 함께 확인하면 재무 건전성을 더 정확히 파악할 수 있습니다.',
                },
            },
            {
                '@type': 'Question',
                name: `${displayName}의 성장 추세는 어떤가요?`,
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: '성장성 점수는 매출과 영업이익의 연간 성장률을 5년 추이로 평가합니다. 매출 성장이 지속되면서 영업이익 마진이 함께 늘어난다면 질적 성장으로 볼 수 있습니다. 손익계산서 차트에서 연도별 추이를 직접 확인할 수 있습니다.',
                },
            },
            {
                '@type': 'Question',
                name: `${displayName}의 현금 창출력은 충분한가요?`,
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: '현금창출력 점수는 영업활동현금흐름과 잉여현금흐름(FCF)을 기준으로 산출됩니다. 순이익보다 영업현금흐름이 크면 이익의 질이 높다는 의미이며, 꾸준한 FCF는 배당·자사주매입·투자 여력을 나타냅니다.',
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
                <SymbolPageHeading>{displayName} 재무제표</SymbolPageHeading>
                <section className="sr-only">
                    <h2>{displayName} 재무제표 분석 개요</h2>
                    <p>
                        {displayName}의 손익계산서(매출·영업이익·순이익·EPS),
                        재무상태표(자산·부채·자본), 현금흐름표(영업활동현금흐름·
                        잉여현금흐름)를 5년 추이로 분석합니다. 성장성,
                        수익성·질, 안정성, 현금창출력 4개 축의 재무 종합 점수와
                        주요 재무비율을 함께 제공합니다.
                    </p>
                </section>

                <FinancialsScorecard
                    scorecard={scorecard}
                    currency={statementCurrencyOf(upper)}
                />

                {/* audit fix FIX 2: XOR — FinancialsAiSummary (client widget) and
                    FinancialsSnapshotProse (SSR prose) both render the same AI
                    conclusion (overallConclusionKo/axisAssessments/
                    riskFactorsKo). Showing both duplicated the text for sighted
                    users and screen readers and doubled as a duplicate-content
                    SEO risk. When the snapshot is renderable, show the prose
                    only; the widget stays mounted with `hideView` so it keeps publishing chat
                    context, and renders its own view only when no snapshot
                    exists — FinancialsAiSummary fetches its analysis via a
                    client-side hook, so during ISR generation it bakes its
                    loading skeleton into the static HTML (no crawlable AI text)
                    until it hydrates. */}
                {showFinancialsProse && (
                    <FinancialsSnapshotProse
                        content={financialsSnapshot?.content}
                        symbol={upper}
                        displayName={displayName}
                        marketProfile={marketProfile}
                        generatedAt={financialsSnapshot?.generatedAt}
                    />
                )}
                <FinancialsAiSummary
                    symbol={upper}
                    hideView={showFinancialsProse}
                />

                <FinancialsStatements
                    symbol={upper}
                    annualSnapshot={snapshot}
                />

                <CrossLinkCards
                    symbol={upper}
                    current="financials"
                    marketProfile={marketProfile}
                />
            </main>
        </>
    );
}
