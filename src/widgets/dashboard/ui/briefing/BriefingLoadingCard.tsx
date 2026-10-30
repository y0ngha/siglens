/**
 * 브리핑이 아직 없을 때의 자리 표시 카드.
 */
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';

/**
 * 서버 seed가 없으면 서버 HTML에도 이 카드가 나가, 브리핑이 도착해도 아래 섹터 신호
 * 패널이 밀리지 않는다.
 *
 * `min-h-64`는 **추정치**다 — 실제 카드는 요약 길이·테마 수·섹터 줄 유무에 따라
 * 높이가 달라 정확히 맞출 수 없다. 데스크톱 폭의 전형적인 카드에 가깝게 잡아
 * 이동량을 줄이는 것이 목적이다.
 */
export function BriefingLoadingCard() {
    const t = useTranslations('widgets.dashboard');
    return (
        <div
            role="status"
            aria-live="polite"
            className={cn(SURFACE_CARD, 'min-h-64 p-4')}
        >
            <div className="flex items-center gap-2">
                <div className="h-2 w-2 animate-pulse rounded-full bg-secondary-700/50" />
                <p className="text-sm text-secondary-500">
                    {t('BriefingCard.38eff4')}
                </p>
            </div>
        </div>
    );
}
