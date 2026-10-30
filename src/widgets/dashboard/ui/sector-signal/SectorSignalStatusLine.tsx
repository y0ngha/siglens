/**
 * 섹터 신호 패널의 스크린리더 전용 상태 줄.
 */
import { useTranslations } from 'next-intl';
import type { SectorSignalsStatus } from '../../hooks/useSectorSignals';
import {
    countSubsectionStocks,
    isSectorViewEmpty,
    type SectorSignalView,
} from '../../utils/sectorSignalStocks';

interface SectorSignalStatusLineProps {
    status: SectorSignalsStatus;
    view: SectorSignalView;
}

/**
 * 패널에서 낭독되는 live region은 이 한 줄뿐이다. 섹션 전체(탭·타임프레임·소절 카드)를
 * live region으로 두면 탭이나 타임프레임을 바꿀 때마다 수십 개 카드가 통째로 낭독된다.
 *
 * 줄은 항상 마운트해 둔다 — 내용이 바뀔 때만 낭독되고, 조회 실패는 알림(`role="alert"`)이
 * 따로 맡으므로 비워 둔다.
 */
export function SectorSignalStatusLine({
    status,
    view,
}: SectorSignalStatusLineProps) {
    const t = useTranslations('widgets.dashboard');
    const counts = countSubsectionStocks(view);

    const messageByStatus: Record<SectorSignalsStatus, string> = {
        loading: t('SectorSignalPanel.loading'),
        error: '',
        ready: isSectorViewEmpty(view)
            ? t('SectorSignalPanel.ab2e36')
            : t('SectorSignalPanel.statusSummary', {
                  v0: counts.bullishConfirmed,
                  v1: counts.bullishExpected,
                  v2: counts.mixed,
                  v3: counts.bearishExpected,
                  v4: counts.bearishConfirmed,
              }),
    };

    return (
        <p role="status" className="sr-only">
            {messageByStatus[status]}
        </p>
    );
}
