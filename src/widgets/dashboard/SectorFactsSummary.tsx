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
 * Returns `null` when there are no signals (avoids an empty section in HTML).
 */
export function SectorFactsSummary({ data }: SectorFactsSummaryProps) {
    const facts = buildSectorFacts(data);
    if (facts.length === 0) return null;

    return (
        <section
            aria-label="섹터별 신호 요약"
            className="sector-panel-bg px-6 py-10 lg:px-[15vw]"
        >
            <h2 className="text-secondary-200 mb-6 text-sm font-semibold tracking-[0.15em] uppercase">
                섹터별 신호 모아보기
            </h2>
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
                                    ({fact.topSymbols.join(', ')})
                                </span>
                            )}
                        </dd>
                    </div>
                ))}
            </dl>
        </section>
    );
}
