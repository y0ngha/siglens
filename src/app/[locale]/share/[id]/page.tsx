import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { getCachedSharedAnalysis } from '@/entities/shared-analysis/actions/getCachedSharedAnalysis';
import { resolveAsOf } from '@/entities/shared-analysis/lib/resolveAsOf';
import { kindLabelKey } from '@/widgets/share';
import { buildShareMetadata } from '@/entities/shared-analysis/lib/buildShareSeo';
import { ShareKindPanel } from '@/views/share';
import { formatKoreanDateTime } from '@/shared/lib/formatKoreanDateTime';
import { SITE_NAME } from '@/shared/lib/seo';
import { INVESTMENT_DISCLAIMER_KEY } from '@/shared/lib/legal';
import { DEFAULT_LOCALE, isLocale } from '@/shared/i18n/locales';

// 공유 스냅샷은 id별로 달라 정적 생성 불가 → force-dynamic
export const dynamic = 'force-dynamic';

interface Props {
    params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id, locale } = await params;
    const resolved = isLocale(locale) ? locale : DEFAULT_LOCALE;
    // 스냅샷 조회와 번역자 둘은 서로 독립이다 — 직렬로 두면 캐시 미스 시
    // DB 왕복이 끝날 때까지 번역자 로드가 시작조차 하지 않는다.
    //
    // OG description의 방향성 라벨도 같은 로케일로 — 예전엔 한국어 상수라
    // 영어 제목 아래 `강세 · …`가 실려 나갔다.
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
    return buildShareMetadata(lookup, id, tSeo, resolved, tOg);
}

export default async function SharePage({ params }: Props) {
    const { locale, id } = await params;
    // 정적 렌더 활성화. 이 호출이 없으면 next-intl의 서버 API가 `headers()`로
    // 폴백해 **이 라우트의 ISR이 통째로 꺼진다**(빌드 route 표에서 `●` → `ƒ`).
    // 실측으로 확인했다 — Next 16.2는 `next/root-params` 미지원이라 이 경로가 유일하다.
    setRequestLocale(locale);
    const t = await getTranslations('app.share');
    const lookup = await getCachedSharedAnalysis(id);

    if (lookup.status !== 'found') {
        // Intentional: returns HTTP 200 (not notFound()) so the user sees a
        // friendly expired-link page instead of a generic 404. The noindex
        // metadata in buildShareMetadata() prevents search engines from
        // indexing this expired/not-found state.
        return (
            <main className="page-container flex flex-1 flex-col items-center py-20 text-center">
                <p className="text-sm font-semibold tracking-[0.01em] text-primary-400">
                    {t('page.0658dd')}
                </p>
                <h1 className="mt-4 text-2xl font-bold text-secondary-50 sm:text-3xl">
                    {t('page.365a70')}
                </h1>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-secondary-400">
                    {t('page.7c95d5', { v0: SITE_NAME })}
                </p>
                <Link
                    href="/"
                    className="mt-8 rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    {t('page.ba81f0', { v0: SITE_NAME })}
                </Link>
            </main>
        );
    }

    const { snapshot, createdAt } = lookup;
    const ticker = snapshot.symbol.toUpperCase();
    const resolvedLocale = isLocale(locale) ? locale : DEFAULT_LOCALE;
    const asOf = formatKoreanDateTime(
        resolveAsOf(snapshot, createdAt),
        resolvedLocale
    );
    const tLabel = await getTranslations('shared.enumLabel');
    const tLegal = await getTranslations('shared.lib.legal');
    const label = tLabel(kindLabelKey(snapshot.kind));
    return (
        <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
            {/* 이 h1에는 텍스트 스타일이 없다 — 의도된 것이다. 직접 텍스트 노드가
                없고 네 개의 자식 span이 각자 크기·굵기·색을 갖는 브레드크럼 형태라
                (SIGLENS / TICKER [종류]), 상속색은 화면에 나타나지 않는다.
                "색 클래스 없는 heading" 스캐너가 이 줄을 반복해서 잡는데, 그 판정
                기준은 **직접 텍스트를 가진 heading**에만 적용된다. 여기에 색을 얹으면
                아무 데도 안 쓰이는 죽은 클래스가 된다. */}
            <h1 className="mb-6 flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-secondary-500">
                    {SITE_NAME}
                </span>
                <span className="text-sm text-secondary-500">/</span>
                <span className="text-xl font-bold text-secondary-100">
                    {ticker}
                </span>
                <span className="rounded bg-primary-900/40 px-2 py-0.5 text-xs font-semibold text-primary-300">
                    {label}
                </span>
            </h1>

            <div className="mb-6 rounded-lg border border-secondary-700 bg-secondary-800/50 px-3 py-2 text-xs text-secondary-400">
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
                    className="inline-flex items-center rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    {t('page.69aebc', { v0: SITE_NAME, v1: ticker })}
                </Link>
            </div>
        </main>
    );
}
