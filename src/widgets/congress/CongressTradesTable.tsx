import { useTranslations } from 'next-intl';
import type {
    Chamber,
    CongressOwner,
    CongressTrade,
    CongressTradeSide,
} from '@y0ngha/siglens-core';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import { cn } from '@/shared/lib/cn';
import {
    AmountRangeTooltip,
    ChamberColumnTooltip,
    DisclosureLagTooltip,
    SenateDisclosureTooltip,
} from './congressTooltips';
import { CongressTradesEmpty } from './CongressTradesEmpty';

/** Max rows rendered in a single SSR pass (newest-first). */
const MAX_ROWS = 50;

export const SENATE_EFD_SEARCH_URL = 'https://efdsearch.senate.gov/search/';

/** Number of PTR UUID characters shown as a prefix hint in the disclosure cell. */
export const PTR_ID_PREFIX_LENGTH = 8;

/**
 * Senate efdsearch deep links return 403/404 outside the disclaimer-accepted
 * session, so senate links always point to the search landing page instead of
 * the original deep link. House PDF links (disclosures-clerk.house.gov) are
 * static and stay direct.
 */
function getDisclosureHref(chamber: Chamber, link: string): string {
    return chamber === 'senate' ? SENATE_EFD_SEARCH_URL : link;
}

/**
 * Returns null if the URL doesn't match the expected shape (defensive fallback —
 * FMP may change the URL structure).
 *
 * The trailing `$` anchor is intentionally omitted so the regex stays robust
 * to future query strings or fragments appended to the URL.
 */
function extractSenatePtrId(link: string): string | null {
    const match = link.match(/\/view\/ptr\/([0-9a-f-]+)/i);
    return match ? match[1] : null;
}

const CHAMBER_LABEL: Record<Chamber, string> = {
    senate: 'chamber.senate',
    house: 'chamber.house',
};

/**
 * Korean label map for the `side` field.
 *
 * "매수" / "매도" are the unambiguous market terms; "unknown" renders no badge
 * so we map it to an empty string and omit the element entirely in the render.
 */
const SIDE_LABEL: Record<CongressTradeSide, string> = {
    buy: 'tradeSide.buy',
    sell: 'tradeSide.sell',
    unknown: '',
};

const SIDE_CLASS: Record<CongressTradeSide, string> = {
    buy: 'text-ui-success-text',
    sell: 'text-ui-danger-text',
    unknown: 'text-secondary-400',
};

/**
 * Korean label map for the `owner` field.
 *
 * 'unknown' is intentionally omitted from rendering — the badge is suppressed
 * when the owner is not disclosed.
 */
const OWNER_LABEL: Record<CongressOwner, string> = {
    self: 'owner.self',
    spouse: 'owner.spouse',
    joint: 'owner.joint',
    child: 'owner.child',
    unknown: '',
};

/**
 * Returns a concise Korean badge label for an FMP `assetType` string.
 *
 * FMP ships free-form strings (e.g. "Stock", "Stock Option"), so we do a
 * case-insensitive substring match rather than strict equality to be resilient
 * to minor label changes in the upstream API.
 */
function assetTypeBadgeKey(assetType: string): string {
    const lower = assetType.toLowerCase();
    if (lower.includes('option')) return 'option';
    if (lower.includes('stock')) return 'stock';
    return 'other'; // fallback: 알 수 없는 자산 유형은 한 라벨로 통일
}

interface ChamberBadgeProps {
    chamber: Chamber;
}

function ChamberBadge({ chamber }: ChamberBadgeProps) {
    const tLabel = useTranslations('shared.enumLabel');
    const t = useTranslations('widgets.congress');
    const label = tLabel(CHAMBER_LABEL[chamber]);

    return (
        <span
            className={cn(
                'rounded px-1.5 py-0.5 text-xs font-medium',
                chamber === 'senate'
                    ? 'bg-primary-500/10 text-primary-400'
                    : 'bg-secondary-700 text-secondary-300'
            )}
            aria-label={
                chamber === 'senate'
                    ? t('CongressTradesTable.27edc1')
                    : t('CongressTradesTable.d8edd7')
            }
        >
            {label}
        </span>
    );
}

interface SideBadgeProps {
    side: CongressTradeSide;
}

function SideBadge({ side }: SideBadgeProps) {
    const tLabel = useTranslations('shared.enumLabel');
    const label = tLabel(SIDE_LABEL[side]);
    if (!label) {
        return <span className={cn('text-xs', SIDE_CLASS[side])}>—</span>;
    }
    return (
        <span
            className={cn(
                'rounded px-1.5 py-0.5 text-xs font-medium',
                side === 'buy' ? 'bg-ui-success/10' : 'bg-ui-danger/10',
                SIDE_CLASS[side]
            )}
        >
            {label}
        </span>
    );
}

interface OwnerBadgeProps {
    owner: CongressOwner;
}

function OwnerBadge({ owner }: OwnerBadgeProps) {
    const tLabel = useTranslations('shared.enumLabel');
    const label = tLabel(OWNER_LABEL[owner]);
    if (!label) return null;
    return (
        <span className="rounded bg-secondary-700 px-1.5 py-0.5 text-xs text-secondary-300">
            {label}
        </span>
    );
}

interface AssetTypeBadgeProps {
    assetType: string;
}

function AssetTypeBadge({ assetType }: AssetTypeBadgeProps) {
    const tAsset = useTranslations('widgets.congress.assetType');
    const label = tAsset(assetTypeBadgeKey(assetType));
    return (
        <span className="rounded bg-secondary-700 px-1.5 py-0.5 text-xs text-secondary-300">
            {label}
        </span>
    );
}

interface DisclosureCellProps {
    chamber: Chamber;
    link: string;
    office: string;
    transactionDate: string;
}

/**
 * For senate rows, the href routes to the efdsearch landing page (see
 * `getDisclosureHref`) and the PTR UUID prefix is displayed separately so
 * users can copy-paste it into the search form after accepting the disclaimer.
 * House rows link directly to the PDF document — no PTR hint needed.
 */
function DisclosureCell({
    chamber,
    link,
    office,
    transactionDate,
}: DisclosureCellProps) {
    const tLabel = useTranslations('shared.enumLabel');
    const t = useTranslations('widgets.congress');
    const isSenate = chamber === 'senate';
    const href = getDisclosureHref(chamber, link);
    const ptrId = isSenate ? extractSenatePtrId(link) : null;

    return (
        <div>
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('disclosureLink', {
                    v0: tLabel(CHAMBER_LABEL[chamber]),
                    v1: office,
                    v2: transactionDate,
                    v3: isSenate
                        ? t('disclosureSearch')
                        : t('disclosureDocument'),
                })}
                className="rounded text-xs text-primary-400 underline transition-colors hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
                {isSenate
                    ? t('CongressTradesTable.fdf8d2')
                    : t('CongressTradesTable.26d466')}
            </a>
            {isSenate && <InfoTooltip>{SenateDisclosureTooltip}</InfoTooltip>}
            {isSenate && ptrId && (
                <span className="block font-mono text-[10px] whitespace-nowrap text-secondary-400">
                    PTR {ptrId.slice(0, PTR_ID_PREFIX_LENGTH)}…
                </span>
            )}
        </div>
    );
}

interface CongressTradesTableProps {
    trades: CongressTrade[];
}

/**
 * SSR table of congressional trade disclosures for a symbol.
 *
 * Renders the most recent `MAX_ROWS` rows (newest first). Falls back to
 * `CongressTradesEmpty` when the `trades` array is empty — this is the
 * table-level empty path and is distinct from the AI summary's `no_trades`
 * branch (`CongressTrendSummaryEmpty`).
 *
 * All `InfoTooltip` triggers are `'use client'` internally; this component
 * itself is RSC-safe (no hooks, no browser APIs at module scope).
 */
export function CongressTradesTable({ trades }: CongressTradesTableProps) {
    const t = useTranslations('widgets.congress');
    if (trades.length === 0) {
        return <CongressTradesEmpty />;
    }

    const rows = trades.slice(0, MAX_ROWS);

    return (
        <div className="rounded-xl border border-secondary-700 bg-secondary-800">
            <p className="px-4 pt-3 pb-0 text-xs text-secondary-400 sm:hidden">
                {t('CongressTradesTable.b488b1')}
            </p>
            <div
                className="overflow-x-auto rounded-xl focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                role="region"
                aria-label={t('CongressTradesTable.373579')}
                tabIndex={0}
            >
                <table className="w-full text-sm">
                    <caption className="sr-only">
                        {t('CongressTradesTable.de5545')}
                    </caption>
                    <thead>
                        <tr className="border-b border-secondary-700 text-xs tracking-widest text-secondary-400 uppercase">
                            <th
                                scope="col"
                                className="px-4 py-3 text-left font-medium whitespace-nowrap"
                            >
                                {t('CongressTradesTable.af2fee')}
                                <InfoTooltip>
                                    {ChamberColumnTooltip}
                                </InfoTooltip>
                            </th>
                            <th
                                scope="col"
                                className="px-4 py-3 text-left font-medium whitespace-nowrap"
                            >
                                {t('CongressTradesTable.29c3ae')}
                            </th>
                            <th
                                scope="col"
                                className="px-4 py-3 text-left font-medium whitespace-nowrap"
                            >
                                {t('CongressTradesTable.67600a')}
                            </th>
                            <th
                                scope="col"
                                className="px-4 py-3 text-left font-medium whitespace-nowrap"
                            >
                                {t('CongressTradesTable.c8eed2')}
                                <InfoTooltip>{AmountRangeTooltip}</InfoTooltip>
                            </th>
                            <th
                                scope="col"
                                className="px-4 py-3 text-left font-medium whitespace-nowrap"
                            >
                                {t('CongressTradesTable.29efb6')}
                            </th>
                            <th
                                scope="col"
                                className="px-4 py-3 text-left font-medium whitespace-nowrap"
                            >
                                {t('CongressTradesTable.e6fa15')}
                            </th>
                            <th
                                scope="col"
                                className="px-4 py-3 text-left font-medium whitespace-nowrap"
                            >
                                {t('CongressTradesTable.1ed947')}
                                <InfoTooltip>
                                    {DisclosureLagTooltip}
                                </InfoTooltip>
                            </th>
                            <th
                                scope="col"
                                className="px-4 py-3 text-left font-medium whitespace-nowrap"
                            >
                                {t('CongressTradesTable.0c2cd8')}
                            </th>
                            <th
                                scope="col"
                                className="px-4 py-3 text-left font-medium whitespace-nowrap"
                            >
                                {t('CongressTradesTable.5073ef')}
                            </th>
                            <th
                                scope="col"
                                className="px-4 py-3 text-left font-medium whitespace-nowrap"
                            >
                                {t('CongressTradesTable.26d466')}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(trade => (
                            <tr
                                key={`${trade.office}-${trade.transactionDate}-${trade.side}-${trade.amount}`}
                                className="border-b border-secondary-700/50 transition-colors last:border-b-0 hover:bg-secondary-700/30"
                            >
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
                                    <AssetTypeBadge
                                        assetType={trade.assetType}
                                    />
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
                                            transactionDate={
                                                trade.transactionDate
                                            }
                                        />
                                    ) : (
                                        <span className="text-xs text-secondary-400">
                                            —
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
