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
} from './congressTooltips';
import { CongressTradesEmpty } from './CongressTradesEmpty';

/** Max rows rendered in a single SSR pass (newest-first). */
const MAX_ROWS = 50;

const CHAMBER_LABEL: Record<Chamber, string> = {
    senate: '상원',
    house: '하원',
};

/**
 * Korean label map for the `side` field.
 *
 * "매수" / "매도" are the unambiguous market terms; "unknown" renders no badge
 * so we map it to an empty string and omit the element entirely in the render.
 */
const SIDE_LABEL: Record<CongressTradeSide, string> = {
    buy: '매수',
    sell: '매도',
    unknown: '',
};

const SIDE_CLASS: Record<CongressTradeSide, string> = {
    buy: 'text-chart-bullish',
    sell: 'text-chart-bearish',
    unknown: 'text-secondary-400',
};

/**
 * Korean label map for the `owner` field.
 *
 * 'unknown' is intentionally omitted from rendering — the badge is suppressed
 * when the owner is not disclosed.
 */
const OWNER_LABEL: Record<CongressOwner, string> = {
    self: '본인',
    spouse: '배우자',
    joint: '공동',
    child: '자녀',
    unknown: '',
};

/**
 * Returns a concise Korean badge label for an FMP `assetType` string.
 *
 * FMP ships free-form strings (e.g. "Stock", "Stock Option"), so we do a
 * case-insensitive substring match rather than strict equality to be resilient
 * to minor label changes in the upstream API.
 */
function assetTypeBadge(assetType: string): string {
    const lower = assetType.toLowerCase();
    if (lower.includes('option')) return '옵션';
    if (lower.includes('stock')) return '주식';
    return '기타'; // fallback: 알 수 없는 자산 유형은 한국어 레이블로 통일
}

interface ChamberBadgeProps {
    chamber: Chamber;
}

function ChamberBadge({ chamber }: ChamberBadgeProps) {
    const label = CHAMBER_LABEL[chamber];

    return (
        <span
            className={cn(
                'rounded px-1.5 py-0.5 text-xs font-medium',
                chamber === 'senate'
                    ? 'bg-primary-500/10 text-chart-bullish'
                    : 'bg-secondary-700 text-secondary-300'
            )}
            aria-label={chamber === 'senate' ? '상원 (Senate)' : '하원 (House)'}
        >
            {label}
        </span>
    );
}

interface SideBadgeProps {
    side: CongressTradeSide;
}

function SideBadge({ side }: SideBadgeProps) {
    const label = SIDE_LABEL[side];
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
    const label = OWNER_LABEL[owner];
    if (!label) return null;
    return (
        <span className="bg-secondary-700 text-secondary-300 rounded px-1.5 py-0.5 text-xs">
            {label}
        </span>
    );
}

interface AssetTypeBadgeProps {
    assetType: string;
}

function AssetTypeBadge({ assetType }: AssetTypeBadgeProps) {
    const label = assetTypeBadge(assetType);
    return (
        <span className="bg-secondary-700 text-secondary-300 rounded px-1.5 py-0.5 text-xs">
            {label}
        </span>
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
    if (trades.length === 0) {
        return <CongressTradesEmpty />;
    }

    const rows = trades.slice(0, MAX_ROWS);

    return (
        <div className="border-secondary-700 bg-secondary-800 rounded-xl border">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <caption className="sr-only">의회 거래 공시 목록</caption>
                    <thead>
                        <tr className="text-secondary-400 border-secondary-700 border-b text-xs tracking-widest uppercase">
                            <th
                                scope="col"
                                className="px-4 py-3 text-left font-medium whitespace-nowrap"
                            >
                                구분
                                <InfoTooltip>
                                    {ChamberColumnTooltip}
                                </InfoTooltip>
                            </th>
                            <th
                                scope="col"
                                className="px-4 py-3 text-left font-medium whitespace-nowrap"
                            >
                                의원
                            </th>
                            <th
                                scope="col"
                                className="px-4 py-3 text-left font-medium whitespace-nowrap"
                            >
                                매수/매도
                            </th>
                            <th
                                scope="col"
                                className="px-4 py-3 text-left font-medium whitespace-nowrap"
                            >
                                금액 구간
                                <InfoTooltip>{AmountRangeTooltip}</InfoTooltip>
                            </th>
                            <th
                                scope="col"
                                className="px-4 py-3 text-left font-medium whitespace-nowrap"
                            >
                                종류
                            </th>
                            <th
                                scope="col"
                                className="px-4 py-3 text-left font-medium whitespace-nowrap"
                            >
                                거래일
                            </th>
                            <th
                                scope="col"
                                className="px-4 py-3 text-left font-medium whitespace-nowrap"
                            >
                                공시일
                                <InfoTooltip>
                                    {DisclosureLagTooltip}
                                </InfoTooltip>
                            </th>
                            <th
                                scope="col"
                                className="px-4 py-3 text-left font-medium whitespace-nowrap"
                            >
                                보유자
                            </th>
                            <th
                                scope="col"
                                className="px-4 py-3 text-left font-medium whitespace-nowrap"
                            >
                                자산 설명
                            </th>
                            <th
                                scope="col"
                                className="px-4 py-3 text-left font-medium whitespace-nowrap"
                            >
                                공시
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((trade, i) => (
                            <tr
                                key={`${trade.office}-${trade.transactionDate}-${i}`}
                                className="hover:bg-secondary-700/30 border-secondary-700/50 border-b transition-colors last:border-b-0"
                            >
                                <td className="px-4 py-3 whitespace-nowrap">
                                    <ChamberBadge chamber={trade.chamber} />
                                </td>

                                <td className="px-4 py-3 whitespace-nowrap">
                                    <div className="text-secondary-100 text-xs font-medium">
                                        {trade.office}
                                    </div>
                                    {trade.district && (
                                        <div className="text-secondary-400 mt-0.5 text-xs">
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

                                <td className="text-secondary-300 px-4 py-3 font-mono text-xs whitespace-nowrap tabular-nums">
                                    {trade.transactionDate}
                                </td>

                                <td className="text-secondary-300 px-4 py-3 font-mono text-xs whitespace-nowrap tabular-nums">
                                    {trade.disclosureDate}
                                </td>

                                <td className="px-4 py-3 whitespace-nowrap">
                                    <OwnerBadge owner={trade.owner} />
                                </td>

                                <td className="px-4 py-3">
                                    <div className="text-secondary-400 max-w-[12rem] truncate text-xs">
                                        {trade.assetDescription}
                                    </div>
                                </td>

                                <td className="px-4 py-3 whitespace-nowrap">
                                    {trade.link ? (
                                        <a
                                            href={trade.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            aria-label={`${CHAMBER_LABEL[trade.chamber]} ${trade.office} ${trade.transactionDate} 공시 문서`}
                                            className="text-primary-400 hover:text-primary-300 text-xs underline transition-colors"
                                        >
                                            공시
                                        </a>
                                    ) : (
                                        <span className="text-secondary-500 text-xs">
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
