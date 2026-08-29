import { useTranslations } from 'next-intl';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import type { FundamentalPeerInput } from '@y0ngha/siglens-core';
import { EmptySectionCard } from './EmptySectionCard';
import { formatCompactCurrency } from '@/shared/lib/priceFormat';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { cn } from '@/shared/lib/cn';

const HEADING_ID = 'peers-heading';
const HEADING_CLASS_NAME = cn('mb-4', HEADING_SECTION);

interface PeersTableProps {
    peers: FundamentalPeerInput[];
}

export function PeersTable({ peers }: PeersTableProps) {
    const t = useTranslations('widgets.fundamental');
    const locale = useResolvedLocale();
    if (peers.length === 0) {
        return (
            <EmptySectionCard
                headingId={HEADING_ID}
                title={t('PeersTable.0f2e1e')}
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
                {t('PeersTable.0f2e1e')}
            </h2>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-secondary-700 text-left text-xs tracking-[0.01em] text-secondary-400">
                            <th className="pb-2 font-medium">
                                {t('PeersTable.c141c2')}
                            </th>
                            <th className="pb-2 font-medium">
                                {t('PeersTable.5e86bf')}
                            </th>
                            <th className="pb-2 text-right font-medium">
                                {t('PeersTable.cf643b')}
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
                                        peer.symbol,
                                        locale
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
