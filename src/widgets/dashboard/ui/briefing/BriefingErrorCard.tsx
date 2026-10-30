/**
 * 브리핑을 만들지 못했을 때의 안내 카드.
 */
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';

/** 실패를 조용히 삼키지 않고 알린다. */
export function BriefingErrorCard() {
    const t = useTranslations('widgets.dashboard');
    return (
        <div role="alert" className={cn(SURFACE_CARD, 'p-4')}>
            <p className="text-sm text-ui-danger-text">
                {t('BriefingCard.8b256d')}
            </p>
        </div>
    );
}
