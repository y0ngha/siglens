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
import { FaqSection } from '@/shared/ui/FaqSection';
import {
    isAdmissibleSymbolShape,
    type SymbolRouteParams,
} from '@/shared/config/market';
import { isUnresolvableDegraded } from '@/shared/lib/symbolGuard';
import { getSeoSnapshotsStatic } from '@/entities/seo-snapshot/lib/getSnapshotStatic';
import {
    buildAssetAboutNode,
    buildDisplayName,
    pickAssetName,
    getAssetInfoResilient,
} from '@/entities/ticker';
import {
    buildBreadcrumbJsonLd,
    buildFaqJsonLd,
    buildSnapshotMetaDescription,
    buildSymbolCongressSeoContent,
    buildSymbolSeoContent,
    buildWebPageJsonLd,
    symbolMetadataFromSeo,
    NOINDEX_SYMBOL_METADATA,
    noindexSymbolMetadata,
    type FaqItem,
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
    const tSeo = await getTranslations({ locale, namespace: 'shared.seo' });
    const upper = symbol.toUpperCase();
    // 본문 notFound()와 일관: 잘못된 ticker는 메타데이터를 비우고 noindex로 응답한다.
    if (!isAdmissibleSymbolShape(upper)) {
        return NOINDEX_SYMBOL_METADATA;
    }
    // 본문 `isTabAllowedForSymbol` 가드와 일관: 크립토 심볼은 congress 탭이 없으므로
    // generateMetadata도 동일 조건에서 NOINDEX로 반환한다. 가드 없이 계속 진행하면
    // 본문은 notFound()(noindex)인데 메타데이터는 canonical + index:true인 soft-404가 만들어진다.
    if (!(await isTabAllowedForSymbol(upper, 'congress'))) {
        return noindexSymbolMetadata(upper, tSeo, locale);
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
    // `displayName`을 가드보다 위에서 계산한다 — 아래 noindex 분기들도
    // `noindexSymbolMetadata`에 넘겨야 차단된 페이지가 티커가 아니라 사명까지
    // 담은 title/description을 갖는다. `buildDisplayName`은 순수 함수라 위치를
    // 올려도 부작용이 없다.
    const displayName = assetInfo
        ? buildDisplayName(assetInfo, upper, locale)
        : upper;
    const noindexOpts = { displayName, koreanName: assetInfo?.koreanName };

    const { profile, degraded: profileDegraded } =
        await getProfileResilient(upper);
    if (profileDegraded || profile === null) {
        return noindexSymbolMetadata(upper, tSeo, locale, noindexOpts);
    }
    // **financials와의 의도적 차이점**: 0건 자체는 정상(sparse 종목)이라, 그것만으로
    // noindex하지 않는다. `degraded === true`(FMP 인프라 실패)는 noindex.
    // getCongressTradesResilient는 React.cache로 메모이즈되므로 본문과 동일한 호출이 즉시 반환된다.
    const { trades, degraded: tradesDegraded } =
        await getCongressTradesResilient(upper);
    if (tradesDegraded) {
        return noindexSymbolMetadata(upper, tSeo, locale, noindexOpts);
    }
    const seo = buildSymbolCongressSeoContent(upper, tSeo, {
        displayName,
        koreanName: assetInfo?.koreanName,
        englishName: assetInfo?.name,
        locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
    });
    const metadata = symbolMetadataFromSeo(seo, locale);

    // snapshot-derived unique description (spec 2026-07-24 Task 8). Same
    // getSeoSnapshotsStatic(upper, revalidate) call the page body makes below —
    // unstable_cache dedupes it within this render, so this is a cache hit, not
    // an extra DB round-trip. Falls back to the templated description when no
    // snapshot exists (backward compatible). og/twitter keep the templated copy
    // — only the search-facing <meta name="description"> is overridden.
    const snap = (await getSeoSnapshotsStatic(upper, revalidate, locale)).find(
        s => s.tab === 'congress'
    );
    const snapshotDescription = snap
        ? buildSnapshotMetaDescription(
              'congress',
              snap.content,
              displayName,
              null,
              locale
          )
        : null;
    // **thin-content 게이트.** 거래 0건이면서 AI 스냅샷도 없으면 본문에 종목 고유
    // 텍스트가 거의 남지 않는다 — 2026-08 실측에서 `B`(1,059자)·`KEEL`(1,079자)이
    // `index, follow`로 사이트맵에 올라 있었고, 크롬(내비·푸터·탭)이 650~750자라
    // 실제 콘텐츠는 300~400자였다. `SITEMAP_SCOPE.md`가 2026-07 노출 붕괴의 기준선으로
    // 기록한 677자와 같은 대역이다.
    //
    // 0건 **그 자체**는 여전히 정상 상태다. 렌더 가능한 프로즈가 있으면 0건이어도
    // 색인한다 — 게이트는 "빈 상태 + 서술 없음"의 교집합에만 걸린다.
    //
    // 존재 여부(`snap !== undefined`)가 아니라 `hasCongressProse`로 판정하는 게 핵심이다.
    // 본문(아래 `showCongressProse`)이 쓰는 것과 **같은** 술어여야 메타와 본문이 갈라지지
    // 않는다. 내용이 빈/깨진 스냅샷 행이 남아 있으면 본문은 프로즈를 안 그리는데
    // 메타만 색인 가능이 되어, 정확히 이 픽스가 겨냥한 thin 페이지가 색인된 채 남는다.
    //
    // `getSeoSnapshotsStatic`이 읽기 실패 시 `[]`로 fail-open하는 건 여기서 문제가 아니다:
    // 본문이 같은 `unstable_cache` 호출을 공유하므로 실패하면 본문에도 프로즈가 없다 —
    // 그 렌더의 페이지는 **실제로** thin이고, noindex가 맞는 판정이다.
    //
    // `NOINDEX_SYMBOL_METADATA`(canonical:null)를 쓰지 않는다. 그건 존재하지 않는
    // 종목·degrade용이고, 이 페이지는 멀쩡히 살아 있으므로 self-canonical을 유지해야
    // 한다. 제목·설명도 사용자(브라우저 탭)에게는 그대로 필요하다.
    // (`follow`는 이제 둘 다 true다 — 2026-08-24에 상수 쪽 `follow:false`를 걷어냈다.
    //  noindex 페이지에 nofollow를 얹으면 `CrossLinkCards`가 뿌리는 형제 탭 링크가
    //  통째로 끊기는데, 그 결함이 차단된 심볼 페이지 전체에 걸려 있었다.)
    if (trades.length === 0 && !hasCongressProse(snap?.content)) {
        return { ...metadata, robots: { index: false, follow: true } };
    }

    return snapshotDescription
        ? { ...metadata, description: snapshotDescription }
        : metadata;
}

export default async function CongressPage({ params }: Props) {
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
        getSeoSnapshotsStatic(upper, revalidate, resolved),
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
    const displayName = assetInfo
        ? buildDisplayName(
              assetInfo,
              upper,
              isLocale(locale) ? locale : DEFAULT_LOCALE
          )
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
            locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
        }
    );

    // about 노드는 stock으로 분류된 경우만 채워지고, ETF/Index/모호한 종목은
    // undefined로 자연 생략된다.
    const aboutNode = buildAssetAboutNode(
        upper,
        assetInfo
            ? pickAssetName(
                  assetInfo,
                  upper,
                  isLocale(locale) ? locale : DEFAULT_LOCALE
              )
            : upper,
        assetInfo?.fmpSymbol
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
            { name: displayName, url: buildSymbolSeoContent(upper, tSeo).url },
            { name: t('page.7b06ac'), url },
        ],
        isLocale(locale) ? locale : DEFAULT_LOCALE
    );

    // FAQ — 화면 `FaqSection`과 FAQPage 구조화데이터의 단일 소스.
    // 아래 sr-only 개요는 공시 항목(거래일·공시일·매수/매도·금액 범위)을 설명하는
    // 다른 내용이라 남겨 둔다.
    const faq: readonly FaqItem[] = [
        {
            question: tSeo('faq.congressMeaning', { v0: displayName }),
            answer: t('page.1a9e0a'),
        },
        {
            question: t('page.72cf41'),
            answer: t('page.a916d9'),
        },
        {
            question: tSeo('faq.congressBuySignal', { v0: displayName }),
            answer: t('page.2c1d31'),
        },
    ];
    const faqJsonLd = buildFaqJsonLd(faq);

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
                        plain={congressSnapshot?.plain}
                    />
                )}
                <CongressTrendSummary
                    symbol={upper}
                    hideView={showCongressProse}
                />

                <CongressTradesTable trades={trades} />

                <FaqSection
                    heading={tSeo('faqHeading.congress', { v0: displayName })}
                    items={faq}
                />
                <CrossLinkCards symbol={upper} current="congress" />
            </main>
        </>
    );
}
