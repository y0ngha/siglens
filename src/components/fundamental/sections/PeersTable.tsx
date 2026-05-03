import Link from 'next/link';
import type { FundamentalPeerInput } from '@y0ngha/siglens-core';

interface PeersTableProps {
    peers: FundamentalPeerInput[];
}

/**
 * RSC section: peer comparison table — lists peer tickers with market cap
 * and links to each peer's fundamental page.
 *
 * Data is fetched by the parent RSC page and passed as a typed prop.
 */
export function PeersTable({ peers }: PeersTableProps) {
    if (peers.length === 0) return null;

    return (
        <section
            aria-labelledby="peers-heading"
            className="border-border bg-card rounded-xl border p-6"
        >
            <h2
                id="peers-heading"
                className="mb-4 text-lg font-semibold tracking-tight"
            >
                동종업계 비교
            </h2>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-muted-foreground border-border border-b text-left text-xs tracking-widest uppercase">
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
                                className="hover:bg-muted/40 border-border/50 border-b transition-colors last:border-b-0"
                            >
                                <td className="py-2.5 pr-4">
                                    <Link
                                        href={`/${peer.symbol}/fundamental`}
                                        className="text-primary font-mono font-medium hover:underline"
                                        translate="no"
                                    >
                                        {peer.symbol}
                                    </Link>
                                </td>
                                <td className="text-muted-foreground py-2.5 pr-4">
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
