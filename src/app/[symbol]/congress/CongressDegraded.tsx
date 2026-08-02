import { SymbolPageHeading } from '@/views/symbol';
import { CongressSnapshotProse } from '@/views/symbol/snapshot/renderers/CongressSnapshotProse';
import { CrossLinkCards } from '@/shared/ui/CrossLinkCards';

interface CongressDegradedProps {
    /** Resolved display name (Korean+English+ticker, or bare-ticker fallback). */
    displayName: string;
    symbol: string;
    /**
     * `seo_analysis_snapshots.content` for the congress tab, when a
     * pre-warmed snapshot exists. Threaded through so degraded pages stay
     * crawlable — spec 2026-07-24 §7: "본문 degraded 분기에서도 섹션 유지".
     * `CongressSnapshotProse` itself renders `null` when the content is
     * absent/empty, so this prop is safe to pass unconditionally.
     */
    snapshotContent?: unknown;
    /** 스냅샷 행의 `generatedAt`. 프로즈 셸의 기준일 캡션에 쓴다. */
    snapshotGeneratedAt?: Date;
}

/**
 * Rendered when the FMP congress trades provider is temporarily unavailable
 * (infra failure — `getCongressTradesResilient` returned `degraded: true`) on
 * the congress route.
 *
 * NOTE: A zero-trade result is NOT a degrade signal on this route. Many tickers
 * legitimately have no congressional trades on record, and that case renders
 * the normal page with the table's empty state — it stays indexable. Only
 * FMP-infra failure flips to this degraded (noindex via `generateMetadata`,
 * soft-200) UI.
 *
 * Mirrors `FinancialsDegraded`: keeps exactly one `<h1>` (SEO) and the
 * cross-route links so the visitor can still reach other tabs while the data
 * provider recovers.
 */
export function CongressDegraded({
    displayName,
    symbol,
    snapshotContent,
    snapshotGeneratedAt,
}: CongressDegradedProps) {
    return (
        <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
            <SymbolPageHeading>{displayName} 의회 거래</SymbolPageHeading>
            <CongressSnapshotProse
                content={snapshotContent}
                symbol={symbol}
                displayName={displayName}
                generatedAt={snapshotGeneratedAt}
            />
            <section className="border-secondary-800 bg-secondary-900/40 rounded-lg border px-5 py-8 text-center">
                <p className="text-secondary-200 text-sm font-medium">
                    의회 거래 데이터를 일시적으로 불러올 수 없어요
                </p>
                <p className="text-secondary-400 mt-2 text-sm leading-relaxed">
                    외부 데이터 제공처가 잠시 응답하지 않고 있어요. 잠시 후 다시
                    방문하시면 상원·하원 의원의 매매 내역을 보실 수 있습니다.
                </p>
            </section>
            <CrossLinkCards symbol={symbol} current="congress" />
        </main>
    );
}
