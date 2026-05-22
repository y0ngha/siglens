/**
 * Fallback shown in place of the AI options analysis card when the underlying
 * snapshot has stale Open Interest (Yahoo dropped OI/bid/ask/IV during the
 * post-close window). Without OI/quote signals the LLM only sees volume and
 * lastPrice, which strip out the metrics the prompt actually reasons about
 * (Max Pain, P/C ratio, top OI strikes, mid/spread). Surfacing this notice
 * skips the analysis call entirely instead of producing low-signal output.
 *
 * Pairs with `OptionsStaleDataBanner` at the top of the page — that banner
 * explains the data gap; this notice tells the user the AI card is paused
 * until the next regular session refreshes Yahoo's quote-side fields.
 *
 * `<div role="status">` (not `<section role="status">`) — `<section>` carries
 * an implicit `region` role that `role="status"` would silently override,
 * losing landmark semantics. `<div>` has no implicit role, so applying
 * `role="status"` is additive. Live-region is intentional: the parent
 * (`OptionsPageClient`) conditionally mounts this notice when `oiStale`
 * flips from false→true after a snapshot refetch, and screen readers
 * should announce the pause to the user.
 */
export function OptionsAiAnalysisStaleNotice() {
    return (
        <div
            aria-labelledby="options-ai-analysis-heading"
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
            role="status"
        >
            <h2
                id="options-ai-analysis-heading"
                className="text-secondary-400 mb-3 text-xs tracking-widest uppercase"
            >
                ⚡ AI 옵션 분석
            </h2>
            <p className="text-secondary-300 text-sm leading-relaxed">
                지금은 AI 옵션 분석을 생성하기 어려워요.
            </p>
            <p className="text-secondary-400 mt-2 text-sm leading-relaxed">
                Open Interest와 호가 데이터가 비어 있어서 Max Pain, P/C Ratio,
                주요 strike 같은 핵심 지표를 계산할 수 없어요.
            </p>
            <p className="text-secondary-400 mt-2 text-sm leading-relaxed">
                데이터가 갱신되면 분석이 자동으로 다시 동작합니다.
            </p>
            <p className="text-secondary-400 mt-2 text-sm leading-relaxed">
                데이터 갱신은 한국 시간 기준 20:00 이후에 일어날 확률이 높아요.
            </p>
        </div>
    );
}
