import { getTranslations } from 'next-intl/server';
import { getCongressPageData } from '@/app/[locale]/[symbol]/congress/congressData';
import { resolveLocale } from '@/shared/i18n/locales';
import { getBlockedSymbolMetadata } from '@/app/[locale]/[symbol]/symbolIndexabilityMetadata';
import { getProfileResilient } from '@/entities/ticker/lib/getProfileResilient';
import { CongressDegraded } from '@/app/[locale]/[symbol]/congress/CongressDegraded';
import { CongressTradesTable } from '@/widgets/congress/CongressTradesTable';
import { CongressTrendSummary } from '@/widgets/congress/CongressTrendSummary';
import { SymbolPageHeading } from '@/views/symbol/ui/SymbolPageHeading';
import { CongressSnapshotProse } from '@/views/symbol/snapshot/renderers/CongressSnapshotProse';
import { hasCongressProse } from '@/entities/seo-snapshot/lib/congressContent';
import { CrossLinkCards } from '@/shared/ui/CrossLinkCards';
import { JsonLd } from '@/shared/ui/JsonLd';
import { type SymbolRouteParams } from '@/shared/config/market';
import { isAdmissibleSymbolShape } from '@/shared/config/ticker';
import { isUnresolvableDegraded } from '@/shared/lib/symbolGuard';
import { getSeoSnapshotsStatic } from '@/entities/seo-snapshot/lib/getSnapshotStatic';
import { buildAssetAboutNode } from '@/entities/ticker/lib/assetClassification';
import { buildDisplayName, pickAssetName } from '@/entities/ticker/lib/ticker';
import { getAssetInfoResilient } from '@/entities/ticker/lib/getAssetInfoResilient';
import {
    ALWAYS_NOINDEX_TAB_ROBOTS,
    buildBreadcrumbJsonLd,
    buildSymbolCongressSeoContent,
    buildSymbolSeoContent,
    symbolMetadataFromSeo,
    noindexInvalidSymbolMetadata,
    noindexSymbolMetadata,
} from '@/shared/lib/seo';
import { buildSymbolWebPageJsonLd } from '@/app/[locale]/[symbol]/symbolWebPageJsonLd';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { isTabAllowedForSymbol } from '@/entities/ticker/api';
import { enterLocale } from '@/shared/lib/enterLocale';

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
    const locale = resolveLocale(rawLocale);
    const tSeo = await getTranslations({ locale, namespace: 'shared.seo' });
    const upper = symbol.toUpperCase();
    // 본문 notFound()와 일관: 잘못된 ticker는 메타데이터를 비우고 noindex로 응답한다.
    if (!isAdmissibleSymbolShape(upper)) {
        return noindexInvalidSymbolMetadata(symbol, locale, 'congress');
    }
    // 본문 `isTabAllowedForSymbol` 가드와 일관: 크립토 심볼은 congress 탭이 없으므로
    // generateMetadata도 동일 조건에서 NOINDEX로 반환한다. 가드 없이 계속 진행하면
    // 본문은 notFound()(noindex)인데 메타데이터는 canonical + index:true인 soft-404가 만들어진다.
    if (!(await isTabAllowedForSymbol(upper, 'congress'))) {
        return noindexSymbolMetadata(upper, tSeo, locale, { tab: 'congress' });
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

    const displayName = assetInfo
        ? buildDisplayName(assetInfo, upper, locale)
        : upper;
    const seo = buildSymbolCongressSeoContent(upper, tSeo, {
        displayName,
        koreanName: assetInfo?.koreanName,
        englishName: assetInfo?.name,
        locale,
    });
    // **항상 noindex** (2026-10-01 SEO 감사, `SEO_RECOVERY_2026_09.md` §10).
    // 프리웜이 이 탭의 산문을 더는 굽지 않는다(`PREWARM_TABS`). 예전 thin-content
    // 게이트("거래 0건 + 산문 없음")는 산문 쪽이 항상 비게 되면서 거래 건수 하나로만
    // 색인을 가르게 됐는데, 거래 목록은 숫자·이름만 바뀌는 표라 색인 근거가 못 된다.
    return {
        ...symbolMetadataFromSeo(seo, locale),
        robots: ALWAYS_NOINDEX_TAB_ROBOTS,
    };
}

export default async function CongressPage({ params }: Props) {
    const { locale: rawLocale, symbol } = await params;
    const locale = enterLocale(rawLocale);
    const t = await getTranslations('app.symbol');
    const tSeo = await getTranslations('shared.seo');
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
        getSeoSnapshotsStatic(upper, revalidate, locale),
    ]);
    const congressSnapshot = (snapshots ?? []).find(s => s.tab === 'congress');
    // audit fix FIX 2: XOR 게이트 — 스냅샷 프로즈가 렌더 가능하면(hasCongressProse)
    // 그것만 보여준다. 클라이언트 AI 위젯은 계속 마운트하되 `hideView`로 UI만 끈다 —
    // 위젯을 아예 렌더하지 않으면 `useRegisterShareable`이 돌지 않아 헤더 공유
    // 버튼이 이 탭의 분석 결과를 등록받지 못한다(review round 2 fix: 챗 발행이
    // 아니라 공유 등록이 이 마운트를 필요로 한다).
    // 두 소스가 동일 필드(summaryKo/notableMembersKo/riskNoteKo)를 같은 순서로
    // 중복 렌더하던 문제(같은 결론을 사용자에게 두 번, 스크린리더에 두 번, 중복
    // 콘텐츠 SEO 리스크)를 해소한다. `OverallSnapshotProse.hasOverallProse` 패턴과
    // 동일 — narrowCongressContent를 재사용해 프로즈 컴포넌트와 동일 판단.
    const showCongressProse = hasCongressProse(congressSnapshot?.content);

    // degraded + digit-first 심볼 = crypto_assets DB와 FMP가 동시 다운 중이고 resolve 불가
    // → 차트 페이지와 동일한 notFound 처리로 sibling 일관성 유지.
    if (isUnresolvableDegraded(upper, degraded)) notFound();

    // assetInfo degraded → generateMetadata returns noindex metadata (above),
    // while the page body renders a 200 with `displayName = upper` as ticker fallback.
    // This mirrors the financials/fundamental pages: a soft-200 keeps the user-facing
    // page navigable while noindex prevents stale/degraded content from being indexed.
    const displayName = assetInfo
        ? buildDisplayName(assetInfo, upper, locale)
        : upper;

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
        tSeo,
        {
            displayName,
            koreanName: assetInfo?.koreanName,
            englishName: assetInfo?.name,
            locale,
        }
    );

    // about 노드는 stock으로 분류된 경우만 채워지고, ETF/Index/모호한 종목은
    // undefined로 자연 생략된다.
    const aboutNode = buildAssetAboutNode(
        upper,
        assetInfo ? pickAssetName(assetInfo, upper, locale) : upper,
        assetInfo?.fmpSymbol
    );

    const jsonLd = buildSymbolWebPageJsonLd({
        url,
        name: fullTitle,
        description,
        about: aboutNode,
        locale,
        // 화면에 실제로 그려지는 스냅샷일 때만 신선도를 주장한다 —
        // 렌더 불가한 행은 본문에 한 글자도 남기지 않는다.
        generatedAt: showCongressProse ? congressSnapshot?.generatedAt : null,
    });

    const breadcrumbJsonLd = buildBreadcrumbJsonLd(
        [
            { name: displayName, url: buildSymbolSeoContent(upper, tSeo).url },
            { name: t('page.7b06ac'), url },
        ],
        locale
    );

    return (
        <>
            <JsonLd data={jsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
                <SymbolPageHeading>
                    {t('page.e607c1', { v0: displayName })}
                </SymbolPageHeading>
                {/* audit fix FIX 2: XOR — CongressTrendSummary (client widget) and
                    CongressSnapshotProse (SSR prose) both render the same AI
                    conclusion (summaryKo/notableMembersKo/riskNoteKo). Showing
                    both duplicated the text for sighted users and screen readers
                    and doubled as a duplicate-content SEO risk. When the
                    snapshot is renderable, show the prose only; the widget
                    stays mounted with `hideView` so `useRegisterShareable`
                    keeps registering Share data, and renders its own view only
                    when no snapshot exists — CongressTrendSummary is a client
                    component that fetches its analysis via a client-side hook,
                    so during ISR generation it bakes its loading skeleton into
                    the static HTML (no crawlable AI text) until it hydrates. */}
                {showCongressProse && (
                    <CongressSnapshotProse
                        content={congressSnapshot?.content}
                        symbol={upper}
                        displayName={displayName}
                        // congress 탭은 us-equity 전용이다 —
                        // CongressSnapshotProseProps JSDoc 참고.
                        marketProfile="us-equity"
                        generatedAt={congressSnapshot?.generatedAt}
                        plain={congressSnapshot?.plain}
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
