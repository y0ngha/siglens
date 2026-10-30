import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { enterLocale } from '@/shared/lib/enterLocale';
import { Breadcrumb } from '@/shared/ui/Breadcrumb';
import { JsonLd } from '@/shared/ui/JsonLd';
import { BacktestCaseList } from '@/widgets/backtesting/BacktestCaseList';
import { BacktestHero } from '@/widgets/backtesting/BacktestHero';
import { BacktestMethodology } from '@/widgets/backtesting/BacktestMethodology';
import { BacktestTabs } from '@/widgets/backtesting/BacktestTabs';
import {
    BACKTEST_DATA,
    BACKTEST_STATS,
    BACKTEST_TICKERS,
} from '@/app/[locale]/backtesting/_lib/backtestingData';
import { buildBacktestingJsonLd } from '@/app/[locale]/backtesting/_lib/backtestingJsonLd';
import { buildBacktestingMetadata } from '@/app/[locale]/backtesting/_lib/backtestingMetadata';

export async function generateMetadata({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    return buildBacktestingMetadata(params);
}

export default async function BacktestingPage({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}) {
    const { locale: rawLocale } = await params;
    const locale = enterLocale(rawLocale);
    const [t, tSeo, tSeoPage] = await Promise.all([
        getTranslations('app.backtesting'),
        getTranslations('shared.seo'),
        getTranslations('app.backtesting.seo'),
    ]);
    // 브레드크럼 마디는 `<title>`용 긴 제목(`AI 백테스팅 — …`)이 아니라 짧은 이름이다.
    // 화면에 보이는 마디와 `BreadcrumbList`의 `name`이 같아야 구글이 마크업을 무시하지 않는다.
    const breadcrumbLabel = t('breadcrumb');
    const { webPageJsonLd, breadcrumbJsonLd, datasetJsonLd } =
        buildBacktestingJsonLd(tSeo, tSeoPage, breadcrumbLabel, locale);
    return (
        <>
            <JsonLd data={webPageJsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <JsonLd data={datasetJsonLd} />
            {/* main이 백테스트 컨텐츠 전체(hero h1 포함)를 감싸야 의미론적
                landmark가 페이지 주제와 일치한다. */}
            <main className="min-h-screen bg-secondary-900">
                <div className="px-6 pt-6">
                    {/* 가시 브레드크럼 — 텍스트가 BreadcrumbList JSON-LD의 `name`과
                        같아야 구글이 마크업을 무시하지 않는다. */}
                    <Breadcrumb trail={[{ label: breadcrumbLabel }]} />
                </div>
                <BacktestHero stats={BACKTEST_STATS} />
                <BacktestMethodology />
                {/* 케이스 목록은 서버 컴포넌트로 렌더해 탭(클라이언트)에 children으로
                    넘긴다 — 케이스 데이터가 RSC 페이로드로 넘어가 카드 트리가 하이드레이션되지
                    않는다. 탭은 보이는 범위만 고른다(BacktestTabs JSDoc). BacktestTabs는
                    useSearchParams()를 렌더 중 호출하지 않으므로(useBacktestFilter 참고)
                    Suspense 경계가 필요 없다. */}
                <BacktestTabs tickers={BACKTEST_TICKERS}>
                    <BacktestCaseList cases={BACKTEST_DATA.cases} />
                </BacktestTabs>
                <div
                    role="note"
                    aria-label={t('page.693b62')}
                    className="border-t border-secondary-700 px-6 py-4"
                >
                    <p className="text-center text-sm text-secondary-400">
                        {t('page.8e0330')}
                    </p>
                </div>
            </main>
        </>
    );
}
