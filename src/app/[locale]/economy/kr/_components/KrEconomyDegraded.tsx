import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';

/**
 * 지표 카드가 아직 하나도 없을 때 지표 자리에 두는 안내. 인제스션이 막 시작돼 과거 `actual`이
 * 덜 쌓인 콜드 스타트가 대표 사례라 "실패"가 아니라 "준비 중"으로 말한다. 캘린더는 이 아래에
 * 그대로 렌더된다(수집 트리거가 거기 있다).
 */
export function KrEconomyDegraded() {
    const t = useTranslations('app.economy');
    return (
        <section
            aria-label={t('page.03f79d')}
            className={cn(SURFACE_CARD, 'p-6')}
        >
            <p className="text-sm text-secondary-400">{t('page.99ee99')}</p>
        </section>
    );
}
