export function OptionsAiAnalysisStaleNotice() {
    // sibling OptionsAiAnalysis는 <section aria-labelledby="...">로 landmark 역할.
    // 같은 region을 mutually exclusive 상태(stale vs ready)로 노출하므로 wrapper
    // 도 <section>으로 통일해 screen reader landmark navigation이 일관되게 한다.
    return (
        <section
            aria-labelledby="options-ai-analysis-heading"
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
        >
            <h2
                id="options-ai-analysis-heading"
                className="text-secondary-400 mb-3 text-xs tracking-widest uppercase"
            >
                AI 옵션 분석
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
                보통 한국 시간 저녁 8시(20:00) 이후에 데이터가 갱신돼요.
            </p>
        </section>
    );
}
