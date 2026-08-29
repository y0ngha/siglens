import { useTranslations } from 'next-intl';
/**
 * /economy degrade UI — 전 축이 비어 있어 의미 있는 정보를 노출할 수 없을 때 200 + noindex로
 * 보여주는 안내. financials `FinancialsDegraded`와 동일 패턴.
 */
export function EconomyDegraded() {
    const t = useTranslations('app.economy');
    return (
        <section className="rounded-lg border border-secondary-700 bg-secondary-800 p-6">
            <h2 className="mb-3 text-lg font-semibold text-secondary-100">
                {t('EconomyDegraded.82acf3')}
            </h2>
            <p className="text-sm leading-relaxed text-secondary-300">
                {t('EconomyDegraded.2e0811')}
            </p>
        </section>
    );
}
