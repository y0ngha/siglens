import { useTranslations } from 'next-intl';
export function OptionsAiAnalysisStaleNotice() {
    const t = useTranslations('widgets.options');
    // sibling OptionsAiAnalysis는 <section aria-labelledby="...">로 landmark 역할.
    // 같은 region을 mutually exclusive 상태(stale vs ready)로 노출하므로 wrapper
    // 도 <section>으로 통일해 screen reader landmark navigation이 일관되게 한다.
    return (
        <section
            aria-labelledby="options-ai-analysis-heading"
            className="rounded-xl border border-secondary-700 bg-secondary-800 p-6"
        >
            <h2
                id="options-ai-analysis-heading"
                className="mb-3 text-xs tracking-widest text-secondary-400 uppercase"
            >
                {t('OptionsAiAnalysisStaleNotice.eefb95')}
            </h2>
            <p className="text-sm leading-relaxed text-secondary-300">
                {t('OptionsAiAnalysisStaleNotice.1e523c')}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-secondary-400">
                {t('OptionsAiAnalysisStaleNotice.6e90d0')}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-secondary-400">
                {t('OptionsAiAnalysisStaleNotice.048b74')}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-secondary-400">
                {t('OptionsAiAnalysisStaleNotice.40026a')}
            </p>
        </section>
    );
}
