import Link from 'next/link';
import type { SectorSignalsResult } from '@y0ngha/siglens-core';
import { buildSectorFacts } from '@/entities/sector-signal';

interface SectorFactsSummaryProps {
    data: SectorSignalsResult;
}

/**
 * Server component that renders sector signal counts as crawlable SSR text.
 *
 * `SectorSignalPanel` uses `useSearchParams` which causes a CSR bailout, leaving
 * the SSR HTML empty for crawlers. This component fills that gap by rendering the
 * same underlying signal data as a static text summary in the Suspense fallback.
 *
 * When JS hydrates, `SectorSignalPanel` takes over with the interactive UI.
 * Both render the same factual data → no cloaking.
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
    const facts = buildSectorFacts(data);

    return (
        <section
            aria-label="섹터별 신호 요약"
            className="sector-panel-bg px-6 py-10 lg:px-[15vw]"
        >
            <h2 className="text-secondary-200 mb-6 text-sm font-semibold tracking-[0.15em] uppercase">
                섹터별 신호 모아보기
            </h2>
            {facts.length === 0 ? (
                <p className="text-secondary-300 text-sm">
                    현재 기술적 신호가 잡힌 종목이 없습니다. 잠시 후 다시 확인해
                    보세요.
                </p>
            ) : (
                <dl className="text-secondary-300 flex flex-col gap-4 text-sm">
                    {facts.map(fact => (
                        <div key={fact.sectorSymbol}>
                            <dt className="text-secondary-400 mb-1 font-medium">
                                {fact.sectorSymbol}
                            </dt>
                            <dd>
                                상승 신호 {fact.bullishCount}종목, 하락 신호{' '}
                                {fact.bearishCount}종목
                                {fact.topSymbols.length > 0 && (
                                    <span className="text-secondary-500 ml-2">
                                        {/* parens as JSX expressions → no stray whitespace around them */}
                                        {'('}
                                        {fact.topSymbols.map((symbol, i) => (
                                            <span key={symbol}>
                                                {i > 0 && ', '}
                                                <Link
                                                    href={`/${symbol}`}
                                                    className="hover:text-secondary-300 focus-visible:ring-primary-500 rounded-sm underline-offset-2 hover:underline focus-visible:ring-1 focus-visible:outline-none"
                                                >
                                                    {symbol}
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
