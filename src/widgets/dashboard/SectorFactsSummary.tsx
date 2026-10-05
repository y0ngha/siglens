import { useTranslations } from 'next-intl';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import type { SectorSignalsResult } from '@y0ngha/siglens-core';
import { buildSectorFacts } from '@/entities/sector-signal/lib/sectorFacts';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { symbolLabel } from '@/shared/lib/symbolLabel';
import { useAssetLabel } from '@/shared/i18n/assetLabel';

interface SectorFactsSummaryProps {
    data: SectorSignalsResult;
}

/**
 * Server component that renders sector signal counts as crawlable SSR text.
 *
 * `SectorSignalPanel` uses `useSearchParams` which causes a CSR bailout, leaving
 * the SSR HTML empty for crawlers. This component fills that gap by rendering the
 * same underlying signal data as a static text summary.
 *
 * ## 영구 서버 sibling이다 — Suspense fallback에 넣지 않는다 (2026-10-05)
 *
 * 예전엔 `SectorSignalPanel`의 Suspense fallback이었다. 그러면 경계가 resolve되는 순간
 * React가 이 서브트리를 클라에서 파괴해, JS를 실행하는 크롤러(Googlebot 렌더러)에게는 링크가
 * 사라지고, raw HTML에서는 `<template>` 숨김 청크 뒤로 밀렸다. 이제 패널(스켈레톤만 fallback)
 * **아래**의 상시 sibling이라 SSR HTML·하이드레이션 후 모두 그대로 남는다. 패널과 같은 사실을
 * 한 번 더 보이지만 간결한 목록이고(같은 데이터 → cloaking 아님), 앵커는 한글명을 붙인다
 * (`애플 (AAPL)`).
 *
 * On a no-signal snapshot (`facts` empty) it renders a minimal sentence instead
 * of `null`, so the prerendered HTML is never text-empty for crawlers (the
 * SSR crawl-text guarantee shouldn't be data-dependent).
 *
 * `topSymbols` render as real `<Link href="/{symbol}">` anchors (not plain text)
 * so this server-rendered hub page passes crawlable internal links into the
 * per-symbol pages — the interactive `SectorSignalPanel` (CSR) is invisible to
 * crawlers, so without these this page would ship zero server-side `/{symbol}` links.
 */
export function SectorFactsSummary({ data }: SectorFactsSummaryProps) {
    const t = useTranslations('widgets.dashboard');
    const assetLabel = useAssetLabel();
    const facts = buildSectorFacts(data);

    return (
        <section
            aria-label={t('SectorFactsSummary.a39a24')}
            className="page-container sector-panel-bg py-6"
        >
            <h2 className={cn('mb-4', HEADING_SECTION)}>
                {t('SectorFactsSummary.581217')}
            </h2>
            {facts.length === 0 ? (
                <p className="text-sm text-secondary-300">
                    {t('SectorFactsSummary.9550ad')}
                </p>
            ) : (
                <dl className="flex flex-col gap-4 text-sm text-secondary-300">
                    {facts.map(fact => (
                        <div key={fact.sectorSymbol}>
                            <dt className="mb-1 font-medium text-secondary-400">
                                {fact.sectorSymbol}
                            </dt>
                            <dd>
                                {t('SectorFactsSummary.e6dcde', {
                                    v0: fact.bullishCount,
                                    v1: fact.bearishCount,
                                })}
                                {fact.topStocks.length > 0 && (
                                    <span className="ml-2 text-secondary-500">
                                        {/* parens as JSX expressions → no stray whitespace around them */}
                                        {'('}
                                        {/* `isCuratedSymbol` 검사 없이 링크한다 — 스캔 대상(`DashboardScope.sectorStocks`)은
                                            전부 큐레이션(색인) 집합이라 noindex 롱테일로 가는 앵커가 없다.
                                            그 불변식은 `shared/config/__tests__/marketHubIndexability.test.ts`가
                                            미국·한국·암호화폐 전 스코프에서 강제한다. */}
                                        {fact.topStocks.map((stock, i) => (
                                            <span key={stock.symbol}>
                                                {i > 0 && ', '}
                                                <Link
                                                    href={`/${stock.symbol}`}
                                                    // 섹터 × 상위 종목 링크가 한 화면에 수십 개라 기본 prefetch면
                                                    // 뷰포트에 들어오는 즉시 종목 RSC(~1.7MB)를 개수만큼 당긴다
                                                    // (docs/architecture/CDN_CACHING.md §1).
                                                    prefetch={false}
                                                    className="rounded underline-offset-2 hover:text-secondary-300 hover:underline focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-950 focus-visible:outline-none"
                                                >
                                                    {symbolLabel(
                                                        stock.symbol,
                                                        assetLabel(
                                                            stock.symbol,
                                                            stock.koreanName
                                                        )
                                                    )}
                                                </Link>
                                            </span>
                                        ))}
                                        {')'}
                                    </span>
                                )}
                            </dd>
                        </div>
                    ))}
                </dl>
            )}
        </section>
    );
}
