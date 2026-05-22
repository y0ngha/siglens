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
 * Server Component(정적 JSX만 사용) — 'use client' 불필요.
 * `<section aria-labelledby>`은 ARIA에서 native role "region"으로 노출되므로
 * role을 명시적으로 덮어쓰지 않는다. 페이지 로드 시 한 번만 조건부로 렌더되는
 * 정적 안내라 live region 의미(role="status")는 부적절.
 */
export function OptionsAiAnalysisStaleNotice() {
    return (
        <section
            aria-labelledby="options-ai-analysis-heading"
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
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
        </section>
    );
}
