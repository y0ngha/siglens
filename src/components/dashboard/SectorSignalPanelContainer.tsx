import { getSectorSignals } from '@/infrastructure/dashboard/sectorSignalsApi';
import { SECTOR_ETFS } from '@/domain/constants/dashboard-tickers';
import { SectorSignalPanel } from './SectorSignalPanel';

interface SectorSignalPanelContainerProps {
    initialSector?: string;
    initialStrict: boolean;
}

export async function SectorSignalPanelContainer({
    initialSector,
    initialStrict,
}: SectorSignalPanelContainerProps) {
    const data = await getSectorSignals();
    const fallbackSector = SECTOR_ETFS[0].symbol;
    const sector =
        initialSector !== undefined &&
        SECTOR_ETFS.some(e => e.symbol === initialSector)
            ? initialSector
            : fallbackSector;
    return (
        <SectorSignalPanel
            data={data}
            initialSector={sector}
            initialStrict={initialStrict}
        />
    );
}
