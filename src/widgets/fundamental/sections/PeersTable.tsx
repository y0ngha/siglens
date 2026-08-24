import Link from 'next/link';
import type { FundamentalPeerInput } from '@y0ngha/siglens-core';
import { EmptySectionCard } from './EmptySectionCard';
import { formatCompactCurrency } from '@/shared/lib/priceFormat';

const HEADING_ID = 'peers-heading';
const HEADING_CLASS_NAME = 'mb-4 text-lg font-semibold tracking-tight';

interface PeersTableProps {
    peers: FundamentalPeerInput[];
}

export function PeersTable({ peers }: PeersTableProps) {
    if (peers.length === 0) {
        return (
            <EmptySectionCard
                headingId={HEADING_ID}
                title="동종업계 비교"
                headingClassName={HEADING_CLASS_NAME}
            />
        );
    }

    return (
        <section
            aria-labelledby={HEADING_ID}
            className="rounded-lg border border-secondary-700 bg-secondary-800 p-6"
        >
            <h2 id={HEADING_ID} className={HEADING_CLASS_NAME}>
                동종업계 비교
            </h2>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-secondary-700 text-left text-xs tracking-widest text-secondary-400 uppercase">
                            <th className="pb-2 font-medium">티커</th>
                            <th className="pb-2 font-medium">회사명</th>
                            <th className="pb-2 text-right font-medium">
                                시가총액
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {peers.map(peer => (
                            <tr
                                key={peer.symbol}
                                className="border-b border-secondary-700/50 transition-colors last:border-b-0 hover:bg-secondary-800/40"
                            >
                                <td className="py-2.5 pr-4">
                                    <Link
                                        href={`/${peer.symbol}/fundamental`}
                                        // 표로 다수 렌더 — docs/architecture/CDN_CACHING.md §1
                                        prefetch={false}
                                        className="rounded font-mono font-medium text-primary-400 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-800 focus-visible:outline-none"
                                        translate="no"
                                    >
                                        {peer.symbol}
                                    </Link>
                                </td>
                                <td className="py-2.5 pr-4 text-secondary-400">
                                    {peer.companyName}
                                </td>
                                <td className="py-2.5 text-right font-mono tabular-nums">
                                    {formatCompactCurrency(
                                        peer.marketCap,
                                        peer.symbol
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
