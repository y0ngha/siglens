/**
 * 섹터 신호 패널 Suspense fallback — 실제 패널과 같은 틀의 자리 표시.
 */
import { useTranslations } from 'next-intl';
import type { ClientDashboardScope } from '@/shared/config/dashboardScope';
import { SubsectionPlaceholders } from './ui/sector-signal/SubsectionPlaceholders';

interface SectorSignalPanelSkeletonProps {
    /** 섹터 탭 자리 개수가 시장마다 다르다(미국 13 / 한국 6). */
    scope: ClientDashboardScope;
}

/** 로딩 중 섹션 하나를 `aria-busy`로 알리고 장식 블록은 숨긴다. */
export function SectorSignalPanelSkeleton({
    scope,
}: SectorSignalPanelSkeletonProps) {
    const t = useTranslations('widgets.dashboard');
    return (
        <section
            aria-label={t('SectorSignalPanelSkeleton.f65a95')}
            aria-busy="true"
            className="page-container sector-panel-bg relative py-10"
        >
            {/* 의미 없는 pulse 영역은 aria-hidden으로 스크린리더에서 숨기고, 상위 section의 aria-label만 안내한다. */}
            <div
                className="mb-6 flex items-center justify-between"
                aria-hidden="true"
            >
                <div className="h-3.5 w-24 animate-pulse rounded bg-secondary-700/50" />
                <div className="h-3.5 w-20 animate-pulse rounded bg-secondary-700/50" />
            </div>
            <div
                className="flex gap-6 overflow-x-auto border-b border-secondary-700 pb-2"
                aria-hidden="true"
            >
                {scope.signalSectors.map(etf => (
                    <div
                        key={etf.symbol}
                        className="h-3 w-12 shrink-0 animate-pulse rounded bg-secondary-700/50"
                    />
                ))}
            </div>
            <div className="mt-6">
                <SubsectionPlaceholders />
            </div>
        </section>
    );
}
