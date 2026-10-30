import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';

/**
 * `/economy` degrade UI — 스냅샷 전 축이 비어(또는 로더 실패) 의미 있는 정보를 노출할 수 없을 때
 * 200 + noindex 렌더로 보여주는 안내. `EconomyContent`가 `generateMetadata`와 같은 판정으로 고른다.
 */
export function EconomyDegraded() {
    const t = useTranslations('app.economy');
    return (
        <section className={cn(SURFACE_CARD, 'p-6')}>
            <h2 className="mb-3 text-lg font-semibold text-secondary-100">
                {t('EconomyDegraded.82acf3')}
            </h2>
            <p className="text-sm leading-relaxed text-secondary-300">
                {t('EconomyDegraded.2e0811')}
            </p>
        </section>
    );
}
