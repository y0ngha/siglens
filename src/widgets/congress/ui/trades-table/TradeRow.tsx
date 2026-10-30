/** One `<tr>` of the congress trades table. */
import type { CongressTrade } from '@y0ngha/siglens-core';
import { AssetTypeBadge } from './AssetTypeBadge';
import { ChamberBadge } from './ChamberBadge';
import { DisclosureCell } from './DisclosureCell';
import { OwnerBadge } from './OwnerBadge';
import { SideBadge } from './SideBadge';

interface TradeRowProps {
    trade: CongressTrade;
}

/** Lays the trade out in the column order declared by `TradesTableHead`. */
export function TradeRow({ trade }: TradeRowProps) {
    return (
        <tr className="border-b border-secondary-700/50 transition-colors last:border-b-0 hover:bg-secondary-700/30">
            <td className="px-4 py-3 whitespace-nowrap">
                <ChamberBadge chamber={trade.chamber} />
            </td>
            <td className="px-4 py-3 whitespace-nowrap">
                <div className="text-xs font-medium text-secondary-100">
                    {trade.office}
                </div>
                {trade.district && (
                    <div className="mt-0.5 text-xs text-secondary-400">
                        {trade.district}
                    </div>
                )}
            </td>
            <td className="px-4 py-3 whitespace-nowrap">
                <SideBadge side={trade.side} />
            </td>
            <td className="px-4 py-3 whitespace-nowrap">
                <span className="font-mono text-xs tabular-nums">
                    {trade.amount.label}
                </span>
            </td>
            <td className="px-4 py-3 whitespace-nowrap">
                <AssetTypeBadge assetType={trade.assetType} />
            </td>
            <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-secondary-300 tabular-nums">
                {trade.transactionDate}
            </td>
            <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-secondary-300 tabular-nums">
                {trade.disclosureDate}
            </td>
            <td className="px-4 py-3 whitespace-nowrap">
                <OwnerBadge owner={trade.owner} />
            </td>
            <td className="px-4 py-3">
                <div
                    className="max-w-[12rem] truncate text-xs text-secondary-400"
                    title={trade.assetDescription}
                >
                    {trade.assetDescription}
                </div>
            </td>
            <td className="px-4 py-3 whitespace-nowrap">
                {trade.link ? (
                    <DisclosureCell
                        chamber={trade.chamber}
                        link={trade.link}
                        office={trade.office}
                        transactionDate={trade.transactionDate}
                    />
                ) : (
                    <span className="text-xs text-secondary-400">-</span>
                )}
            </td>
        </tr>
    );
}
