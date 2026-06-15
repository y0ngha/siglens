import { CrossLinkCards, SymbolPageHeading } from '@/widgets/symbol-page';

interface FinancialsDegradedProps {
    /** Resolved display name (Korean+English+ticker, or bare-ticker fallback). */
    displayName: string;
    symbol: string;
}

/**
 * Rendered when the FMP company profile is temporarily unavailable (infra
 * failure) on the financials route.
 *
 * `getProfileResilient` reports `degraded` and `generateMetadata` (Phase 6)
 * will respond noindex, so this is a soft, non-indexed 200 — never a 500.
 * It keeps exactly one `<h1>` (SEO) and the cross-route links so the visitor
 * can still reach other tabs while the data provider recovers.
 */
export function FinancialsDegraded({
    displayName,
    symbol,
}: FinancialsDegradedProps) {
    return (
        <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
            <SymbolPageHeading>{displayName} 재무제표</SymbolPageHeading>
            <section className="border-secondary-800 bg-secondary-900/40 rounded-lg border px-5 py-8 text-center">
                <p className="text-secondary-200 text-sm font-medium">
                    재무 데이터를 일시적으로 불러올 수 없어요
                </p>
                <p className="text-secondary-400 mt-2 text-sm leading-relaxed">
                    외부 데이터 제공처가 잠시 응답하지 않고 있어요. 잠시 후 다시
                    방문하시면 재무제표를 보실 수 있습니다.
                </p>
            </section>
            <CrossLinkCards symbol={symbol} current="financials" />
        </main>
    );
}
