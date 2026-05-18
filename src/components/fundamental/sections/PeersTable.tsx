import Link from 'next/link';
import type { FundamentalPeerInput } from '@y0ngha/siglens-core';
import { EmptySectionCard } from '@/components/fundamental/sections/EmptySectionCard';

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
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
        >
            <h2
                id={HEADING_ID}
                className={HEADING_CLASS_NAME}
            >
                동종업계 비교
            </h2>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-secondary-400 border-secondary-700 border-b text-left text-xs tracking-widest uppercase">
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
                                className="hover:bg-secondary-800/40 border-secondary-700/50 border-b transition-colors last:border-b-0"
                            >
                                <td className="py-2.5 pr-4">
                                    <Link
                                        href={`/${peer.symbol}/fundamental`}
                                        className="text-primary-400 focus-visible:ring-primary-500 focus-visible:ring-offset-secondary-800 rounded-sm font-mono font-medium hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                                        translate="no"
                                    >
                                        {peer.symbol}
                                    </Link>
                                </td>
                                <td className="text-secondary-400 py-2.5 pr-4">
                                    {peer.companyName}
                                </td>
                                <td className="py-2.5 text-right font-mono tabular-nums">
                                    {new Intl.NumberFormat('ko-KR', {
                                        notation: 'compact',
                                        maximumFractionDigits: 1,
                                        style: 'currency',
                                        currency: 'USD',
                                    }).format(peer.marketCap)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
