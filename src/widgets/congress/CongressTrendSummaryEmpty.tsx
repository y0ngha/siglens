/**
 * Empty-state renderer for the `no_trades` branch unique to congress.
 *
 * Congress 0건 = 정상(NOT an error): many symbols simply have no public-disclosure
 * filings, so the submit pipeline deliberately skips LLM dispatch. This component
 * mirrors the success card's shell + heading so the page layout stays stable and
 * communicates the policy choice without sounding like a failure.
 */
export function CongressTrendSummaryEmpty() {
    return (
        <section
            aria-labelledby="congress-trend-summary-empty-heading"
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
        >
            <h2
                id="congress-trend-summary-empty-heading"
                className="mb-3 text-lg font-semibold tracking-tight"
            >
                AI 동향 해석
            </h2>
            <p className="text-secondary-400 text-sm leading-relaxed">
                최근 의회 거래가 없어 동향 해석을 생성하지 않았어요.
            </p>
        </section>
    );
}
