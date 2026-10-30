/**
 * 섹터 신호 패널의 본문 — 조회 상태에 맞춰 로딩·실패·빈 섹터·다섯 소절 중 하나를 그린다.
 */
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { StockWithConflict } from '@y0ngha/siglens-core';
import type { ClientDashboardScope } from '@/shared/config/dashboardScope';
import type { SectorSignalsStatus } from './hooks/useSectorSignals';
import { SignalSubsection } from './SignalSubsection';
import { SectorSignalError } from './ui/sector-signal/SectorSignalError';
import { SectorSignalLoading } from './ui/sector-signal/SectorSignalLoading';
import {
    isSectorViewEmpty,
    SUBSECTION_IDS,
    type SectorSignalView,
    type SubsectionId,
} from './utils/sectorSignalStocks';
import type { SignalSubsectionVariant } from './utils/subsectionStyles';

/** 소절 하나에 넘길 값 — `SignalSubsection`의 props 중 소절마다 다른 부분. */
interface SubsectionSpec {
    title: string;
    marker: string;
    variant: SignalSubsectionVariant;
    stocks: readonly StockWithConflict[];
    infoMessage?: ReactNode;
}

interface SectorSignalBodyProps {
    scope: ClientDashboardScope;
    status: SectorSignalsStatus;
    view: SectorSignalView;
    onRetry: () => void;
}

/**
 * 조회가 끝나지 않았거나 실패했다면 빈 섹터 안내를 그리지 않는다 — 그러면 "신호 없음"으로
 * 읽힌다. 섹터에 신호가 하나도 없으면 다섯 소절이 같은 "종목 없음"을 되풀이하지 않도록
 * 한 줄로 합친다(이 문구의 낭독은 패널의 상태 줄이 맡는다).
 */
export function SectorSignalBody({
    scope,
    status,
    view,
    onRetry,
}: SectorSignalBodyProps) {
    const t = useTranslations('widgets.dashboard');

    if (status === 'loading') return <SectorSignalLoading />;
    if (status === 'error') return <SectorSignalError onRetry={onRetry} />;
    if (isSectorViewEmpty(view)) {
        return (
            <p className="py-8 text-center text-sm text-secondary-400">
                {t('SectorSignalPanel.ab2e36')}
            </p>
        );
    }

    const { quadrants, mixedStocks } = view;
    const subsections: Record<SubsectionId, SubsectionSpec> = {
        bullishConfirmed: {
            title: t('SectorSignalPanel.080a8a'),
            marker: '▲',
            variant: 'confirmed',
            stocks: quadrants.bullishConfirmed,
        },
        bullishExpected: {
            title: t('SectorSignalPanel.976db4'),
            marker: '△',
            variant: 'expected',
            stocks: quadrants.bullishExpected,
        },
        mixed: {
            title: t('SectorSignalPanel.760c9a'),
            marker: '◈',
            variant: 'mixed',
            stocks: mixedStocks,
            infoMessage: (
                <>
                    <p>{t('SectorSignalPanel.ede11c')}</p>
                    <p>{t('SectorSignalPanel.9c8687')}</p>
                </>
            ),
        },
        bearishExpected: {
            title: t('SectorSignalPanel.880a67'),
            marker: '▽',
            variant: 'expected',
            stocks: quadrants.bearishExpected,
        },
        bearishConfirmed: {
            title: t('SectorSignalPanel.12526e'),
            marker: '▼',
            variant: 'confirmed',
            stocks: quadrants.bearishConfirmed,
        },
    };

    return SUBSECTION_IDS.map(id => (
        <SignalSubsection
            key={id}
            currencySymbol={scope.currencySymbol}
            tickerIsReadable={scope.tickerIsReadable}
            {...subsections[id]}
        />
    ));
}
