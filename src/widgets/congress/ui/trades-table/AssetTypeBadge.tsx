/** Asset-type badge for a trades-table row. */
import { useTranslations } from 'next-intl';
import { assetTypeBadgeKey } from '../../utils/assetTypeBadge';

interface AssetTypeBadgeProps {
    assetType: string;
}

/** Shows one of three localized labels so raw upstream strings never reach the screen. */
export function AssetTypeBadge({ assetType }: AssetTypeBadgeProps) {
    const tAsset = useTranslations('widgets.congress.assetType');
    return (
        <span className="rounded bg-secondary-700 px-1.5 py-0.5 text-xs text-secondary-300">
            {tAsset(assetTypeBadgeKey(assetType))}
        </span>
    );
}
