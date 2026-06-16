/**
 * Empty-state card for the `CongressTradesTable` when there are no trades.
 *
 * This is the table widget's own empty path — distinct from the AI summary's
 * `no_trades` branch (`CongressTrendSummaryEmpty`). It communicates that the
 * SSR trade rows simply came back empty, without implying an error.
 */
export function CongressTradesEmpty() {
    return (
        <div
            role="status"
            aria-label="의회 거래 내역 없음"
            className="border-secondary-700 bg-secondary-800 rounded-xl border px-5 py-4"
        >
            <p className="text-secondary-400 text-sm">거래 내역 없음</p>
        </div>
    );
}
