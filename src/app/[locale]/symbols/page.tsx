import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { loadSymbolNames } from '@/entities/ticker/lib/loadSymbolNames';
import { shortenRevalidateIfDatabaseMissingAtBuild } from '@/shared/cache/buildDegradedRevalidate';
import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
import { INTL_LOCALE } from '@/shared/i18n/locales';
import { enterLocale } from '@/shared/lib/enterLocale';
import { buildSymbolDirectory } from '@/shared/lib/symbolDirectory';
import { Breadcrumb } from '@/shared/ui/Breadcrumb';
import { JsonLd } from '@/shared/ui/JsonLd';
import { SymbolDirectoryList } from '@/app/[locale]/symbols/_components/SymbolDirectoryList';
import { buildSymbolsMetadata } from '@/app/[locale]/symbols/_lib/symbolsMetadata';
import { buildSymbolsJsonLd } from '@/app/[locale]/symbols/_lib/symbolsSeo';

/**
 * 종목 디렉터리 — **내부 링크 고아를 없애는 페이지**다.
 *
 * 2026-09-18 1회성 실측(저장된 기준선 없음): sitemap 심볼 416개 중 147개가 홈에서 3클릭 안에 닿지 않았다
 * (깊이 2에서 sitemap 도달 27%, 깊이 3에서 51%). 다시 재려면 sitemap의 심볼 URL을 센 뒤
 * 홈에서 내부 링크를 너비 우선으로 따라가 깊이별 도달 비율을 센다. 큐레이션 카테고리 84개만 화면에
 * 링크돼 있고 나머지는 `RelatedSymbols` 링에 걸린 것만 발견되기 때문이다. 이
 * 페이지가 푸터(전 라우트)에서 1클릭이므로 목록의 모든 종목이 2클릭이 된다.
 *
 * **문구는 "더 보기"다 — "전체/모든 종목"이 아니다.** 상장 종목 전체가 아니라
 * 우리가 분석을 제공하는 목록이라, 전체라고 쓰면 페이지가 지키지 못하는 약속이 된다.
 *
 * 목록 자체는 상수(`POPULAR_TICKERS`·`POPULAR_CRYPTOS`)라 배포로만 바뀌지만, 표기
 * 이름은 DB에서 온다(`korean_tickers`·`crypto_assets`). DB가 본문을 쥔 정적 페이지는
 * `revalidate` 없이는 응답이 사실상 영구 캐시로 굳어 이름을 고쳐도 화면이 안 바뀐다.
 */
export const revalidate = 86400; // 24h — 이름 캐시 TTL과 같다

export async function generateMetadata({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    return buildSymbolsMetadata(params);
}

export default async function SymbolsDirectoryPage({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}) {
    const { locale: rawLocale } = await params;
    const locale = enterLocale(rawLocale);
    // 배포 빌드에는 DB가 없다 — 이름/미리보기 없이 구워진 이 렌더를 60초 뒤 재생성하게 한다.
    await shortenRevalidateIfDatabaseMissingAtBuild();
    // 이름은 로케일에 맞는 것을 읽는다(ko는 한글명, 나머지는 영문명). 못 읽으면
    // 빈 맵이 와서 티커만 찍힌다 — 링크는 어떤 경우에도 남는다.
    // 번역 로드와 독립이라 함께 기다린다.
    const [t, tNav, tSeo, names] = await Promise.all([
        getTranslations('app.symbols'),
        getTranslations(),
        getTranslations('shared.seo'),
        loadSymbolNames([...POPULAR_TICKERS, ...POPULAR_CRYPTOS], locale),
    ]);
    const sections = buildSymbolDirectory(names, INTL_LOCALE[locale]);

    // 브레드크럼·h1은 짧은 제목을 쓴다. `<title>`의 자산군 꼬리표
    // (`— 미국·한국 주식과 암호화폐`)는 검색 결과용이라 화면에 반복하면 군더더기다.
    const heading = t('page.heading');
    const { webPageJsonLd, breadcrumbJsonLd } = buildSymbolsJsonLd(
        tSeo,
        locale,
        heading
    );

    return (
        <>
            <JsonLd data={webPageJsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8">
                <Breadcrumb trail={[{ label: heading }]} />
                <header className="space-y-2">
                    <h1 className="text-2xl font-bold tracking-tight text-balance text-secondary-50 sm:text-3xl">
                        {heading}
                    </h1>
                    <p className="text-sm text-secondary-400">
                        {t('page.intro')}
                    </p>
                </header>
                <SymbolDirectoryList sections={sections} labelOf={tNav} />
            </main>
        </>
    );
}
