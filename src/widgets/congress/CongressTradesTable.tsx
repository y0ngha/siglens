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
    // 빈 문자열 센티넬은 **번역 전**에 걸러야 한다. `t('')`는 빈 값이 아니라
    // 폴백 문자열 `shared.enumLabel.`을 돌려주기 때문에(truthy) 번역 결과로
    // 판정하면 가드가 죽고 raw 키가 그대로 배지에 찍힌다.
    const sideKey = SIDE_LABEL[side];
    if (!sideKey) {
        return <span className={cn('text-xs', SIDE_CLASS[side])}>—</span>;
    }
    const label = tLabel(sideKey);
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
    // SideBadge와 동일 — 센티넬은 번역 전에 판정한다.
    const ownerKey = OWNER_LABEL[owner];
    if (!ownerKey) return null;
    const label = tLabel(ownerKey);
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
    const t = useTranslations('widgets.congress');
    const tLabel = useTranslations('shared.enumLabel');
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
        <div className="rounded-lg border border-secondary-700 bg-secondary-800">
            {/*
             * `sm:hidden`이 붙어 있었는데, 이 표는 모든 폭에서 넘친다 —
             * 힌트가 사라지는 640px 이상이 정확히 넘치는 구간이었다.
             *
             * 왜 항상 넘치는가: 감싸는 `<main>`이 `max-w-5xl px-4`라 콘텐츠
             * 박스가 뷰포트와 무관하게 992px에서 멈추는데, 이 표는 열 10개가
             * 전부 `whitespace-nowrap`이고 열마다 `px-4`(좌우 32px)라 패딩만
             * 320px이다. 감사 실측 min-content 1148px.
             *
             * 키보드·AT는 `role="region"` + `tabIndex`로 이미 닿지만, macOS의
             * 오버레이 스크롤바는 마우스 사용자에게 아무 단서를 주지 않는다.
             *
             * 형제인 `StatementTable`은 같은 처방을 하면 안 된다 — 그쪽은
             * nowrap이 3곳뿐이라 992px 안에 들어가고, 힌트를 항상 띄우면
             * 데스크톱에서 거짓말이 된다.
             */}
            <p className="px-4 pt-3 pb-0 text-xs text-secondary-400">
                {t('CongressTradesTable.b488b1')}
            </p>
            <div
                className="overflow-x-auto rounded-lg focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                role="region"
                aria-label={t('CongressTradesTable.373579')}
                tabIndex={0}
            >
                <table className="w-full text-sm">
                    <caption className="sr-only">
                        {t('CongressTradesTable.de5545')}
                    </caption>
                    <thead>
                        <tr className="border-b border-secondary-700 text-xs text-secondary-400">
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
                        {rows.map((trade, idx) => (
                            <tr
                                /* 원래 key가 `trade.amount`를 그대로 보간해 객체가
                                   전부 `[object Object]`로 접혔고, 중복 key React
                                   경고가 났다(`/AAPL/congress` 실측 22건).

                                   라벨·종목 설명까지 넣어도 **여전히 중복이 남는다** —
                                   같은 의원이 같은 날 같은 금액 구간으로 두 건을
                                   신고한 실제 데이터가 있다(예: Tommy Tuberville
                                   2025-12-17 매도 $50,001–$100,000 2건). 공시 자료에
                                   자연 키가 없으므로 인덱스를 덧붙여 유일성을
                                   보장한다. 목록은 서버가 정렬해 내려주고 클라이언트
                                   재정렬이 없어 인덱스가 흔들리지 않는다. */
                                key={`${trade.office}-${trade.transactionDate}-${trade.side}-${trade.amount.label}-${trade.assetDescription}-${idx}`}
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
