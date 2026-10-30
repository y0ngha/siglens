import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { getCachedSharedAnalysis } from '@/entities/shared-analysis/actions/getCachedSharedAnalysis';
import { buildShareMetadata } from '@/entities/shared-analysis/lib/buildShareSeo';
import { kindLabelKey } from '@/entities/shared-analysis/lib/kindLabel';
import { resolveAsOf } from '@/entities/shared-analysis/lib/resolveAsOf';
import { resolveLocale } from '@/shared/i18n/locales';
import { brandName } from '@/shared/lib/brandName';
import { cn } from '@/shared/lib/cn';
import { enterLocale } from '@/shared/lib/enterLocale';
import { formatKoreanDateTime } from '@/shared/lib/formatKoreanDateTime';
import { INVESTMENT_DISCLAIMER_KEY } from '@/shared/lib/legal';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { ShareKindPanel } from '@/views/share/ShareKindPanel';
import { shareKrxTickTable } from './shareKrxTickTable';

/** 공유 스냅샷은 id별로 달라 정적 생성 불가 → force-dynamic. */
export const dynamic = 'force-dynamic';

interface Props {
    params: Promise<{ locale: string; id: string }>;
}

/**
 * 공유 스냅샷의 메타데이터(`buildShareMetadata`). 스냅샷이 없거나 만료됐으면 본문과 같은 판정으로
 * 여기서도 404를 던진다.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id, locale } = await params;
    const resolved = resolveLocale(locale);
    // 스냅샷 조회와 번역자 둘은 서로 독립이다 — 직렬로 두면 캐시 미스 시
    // DB 왕복이 끝날 때까지 번역자 로드가 시작조차 하지 않는다.
    // OG description의 방향성 라벨도 같은 로케일 번역자(`tOg`)로 낸다.
    const [lookup, tSeo, tOg] = await Promise.all([
        getCachedSharedAnalysis(id),
        getTranslations({
            locale: resolved,
            namespace: 'entities.shared-analysis.seo',
        }),
        getTranslations({
            locale: resolved,
            namespace: 'entities.shared-analysis.og',
        }),
    ]);
    // 본문과 같은 판정으로 메타데이터 단계에서도 404다. 본문이 notFound()를 던져도
    // generateMetadata 결과가 이기므로, 여기서 최소 메타를 돌려주면 404 응답이 그 title과
    // 루트 레이아웃의 홈 description·og·twitter를 단다. 던지면 404 경계
    // (`[locale]/not-found.tsx`)의 메타가 쓰인다.
    if (lookup.status !== 'found') notFound();
    return buildShareMetadata(lookup, id, tSeo, resolved, tOg);
}

/**
 * 공유된 AI 분석 스냅샷 페이지. 스냅샷이 없거나 만료됐으면 진짜 404를 낸다 — 200 + 만료 안내는
 * 검색엔진이 soft-404로 분류한다. 만료 문구는 `[locale]/NotFoundMessage`가 `/share/` 경로를 보고
 * 그린다.
 */
export default async function SharePage({ params }: Props) {
    const { locale: rawLocale, id } = await params;
    const locale = enterLocale(rawLocale);
    // 번역자와 스냅샷 조회는 서로 독립이라 함께 기다린다.
    const [t, lookup] = await Promise.all([
        getTranslations('app.share'),
        getCachedSharedAnalysis(id),
    ]);

    if (lookup.status !== 'found') notFound();

    const { snapshot, createdAt } = lookup;
    const ticker = snapshot.symbol.toUpperCase();
    const asOf = formatKoreanDateTime(resolveAsOf(snapshot, createdAt), locale);
    // 공유 화면의 가격도 분석을 만든 쪽과 같은 호가표로 보여야 한다(ETF 40,125가 40,150으로 깎이지 않게).
    // 번역 로드와 함께 기다린다(차트 종류에서만 조회 — `shareKrxTickTable`).
    const [tLabel, tLegal, krxTickTable] = await Promise.all([
        getTranslations('shared.enumLabel'),
        getTranslations('shared.lib.legal'),
        shareKrxTickTable(snapshot.kind, ticker),
    ]);
    const label = tLabel(kindLabelKey(snapshot.kind));
    return (
        <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
            {/* 이 h1에는 텍스트 스타일이 없다 — 의도된 것이다. 직접 텍스트 노드가
                없고 네 개의 자식 span이 각자 크기·굵기·색을 갖는 브레드크럼 형태라
                (브랜드 / TICKER [종류]), 상속색은 화면에 나타나지 않는다.
                "색 클래스 없는 heading" 스캐너가 이 줄을 반복해서 잡는데, 그 판정
                기준은 **직접 텍스트를 가진 heading**에만 적용된다. 여기에 색을 얹으면
                아무 데도 안 쓰이는 죽은 클래스가 된다. */}
            <h1 className="mb-6 flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-secondary-500">
                    {brandName(locale)}
                </span>
                <span className="text-sm text-secondary-500">/</span>
                <span className="text-xl font-bold text-secondary-100">
                    {ticker}
                </span>
                <span className="rounded bg-primary-900/40 px-2 py-0.5 text-xs font-semibold text-primary-300">
                    {label}
                </span>
            </h1>

            <div
                className={cn(
                    SURFACE_CARD,
                    'mb-6 px-3 py-2 text-xs text-secondary-400'
                )}
            >
                {t('page.de8fc6', { v0: asOf })}
            </div>

            <ShareKindPanel
                kind={snapshot.kind}
                result={snapshot.result}
                chartBars={snapshot.chartBars}
                assetClass={
                    snapshot.context.assetClass === 'crypto'
                        ? 'crypto'
                        : 'equity'
                }
                symbol={ticker}
                krxTickTable={krxTickTable}
                plain={snapshot.plain}
            />

            <div
                role="note"
                aria-label={t('page.693b62')}
                className="mt-8 rounded-lg border border-ui-danger/30 bg-ui-danger/5 px-4 py-3"
            >
                <p className="text-xs leading-relaxed text-secondary-400">
                    {tLegal(INVESTMENT_DISCLAIMER_KEY)}
                </p>
            </div>

            <div className="mt-8 text-center">
                <Link
                    href={`/${ticker}`}
                    // 종목 RSC(~1.7MB)를 페이지 열자마자 당기지 않는다 — 클릭 시점에 로드한다.
                    prefetch={false}
                    className="inline-flex items-center rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    {t('page.69aebc', { v0: brandName(locale), v1: ticker })}
                </Link>
            </div>
        </main>
    );
}
