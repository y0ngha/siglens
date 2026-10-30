/**
 * 브리핑의 강세·약세 섹터 한 줄 — "상승 섹터 기술, 금융".
 */
import { useAssetLabel } from '@/shared/i18n/assetLabel';
import type { BriefingSector } from '../../utils/briefingSectors';

interface BriefingSectorLineProps {
    label: string;
    sectors: readonly BriefingSector[];
    /** 섹터명 글자색 클래스 — 상승·하락 톤. */
    toneClass: string;
}

const SECTOR_SEPARATOR = ', ';

/** 섹터가 없으면 줄을 그리지 않는다. 섹터명은 심볼로 카탈로그에서 찾아 로케일화한다. */
export function BriefingSectorLine({
    label,
    sectors,
    toneClass,
}: BriefingSectorLineProps) {
    const assetLabel = useAssetLabel();
    if (sectors.length === 0) return null;
    return (
        <p className="text-xs">
            <span className="mr-1 text-secondary-500">{label}</span>
            <span className={toneClass}>
                {sectors
                    .map(sector => assetLabel(sector.symbol, sector.name))
                    .join(SECTOR_SEPARATOR)}
            </span>
        </p>
    );
}
