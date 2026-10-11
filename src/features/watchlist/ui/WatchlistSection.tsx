'use client';

import { useQueries } from '@tanstack/react-query';
import type { Bar } from '@y0ngha/siglens-core';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useOpenTickerSearch } from '../hooks/useOpenTickerSearch';
import { usePortfolioHoldings } from '@/entities/portfolio/hooks/usePortfolioHoldings';
import type {
    RawHoldingInput,
    SavePortfolioResult,
} from '@/entities/portfolio/model';
import type { WatchlistItemView } from '@/entities/watchlist/model';
import { HoldingForm } from '@/features/portfolio-management/ui/HoldingForm';
import { useInViewOnce } from '@/shared/hooks/useInViewOnce';
import { useAssetLabel } from '@/shared/i18n/assetLabel';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import {
    BUTTON_OUTLINE,
    BUTTON_OUTLINE_DANGER,
} from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import {
    formatCurrencyForSymbol,
    formatSignedPercent,
    signColorClass,
} from '@/shared/lib/priceFormat';
import { PLACEHOLDER_ON_INSET } from '@/shared/lib/surfaceStyles';
import { symbolLabel } from '@/shared/lib/symbolLabel';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { useToast } from '@/shared/ui/ToastProvider';
import { useWatchlist } from '../hooks/useWatchlist';
import {
    useWatchlistQuote,
    watchlistQuoteQuery,
} from '../hooks/useWatchlistQuote';
import { quoteFromBars } from '../lib/quoteFromBars';
import { WATCHLIST_ROW_CHROME } from '../lib/watchlistStyles';
import { sortWatchlistItems, type WatchlistSort } from '../lib/sortWatchlist';
import { MiniTrend } from './MiniQuoteRow';

const ACTION_BUTTON = cn(BUTTON_OUTLINE, 'px-3 py-1.5 text-xs');
const DANGER_BUTTON = cn(BUTTON_OUTLINE_DANGER, 'px-3 py-1.5 text-xs');
const NAME_LINK =
    'truncate font-semibold text-secondary-100 transition-colors hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

interface WatchlistSectionProps {
    /** 정렬 기준. 등락률 순일 때만 모든 행의 시세를 한꺼번에 불러온다(그 외에는 보일 때만). */
    sort?: WatchlistSort;
}

/**
 * 시세 쿼리 결과 → 등락률 배열(쿼리 순서 그대로). 모듈 수준에 둬 참조가 안정적이다 — 인라인
 * `combine`은 렌더마다 새 함수라 React Query가 결과를 다시 합친다.
 */
function changesOf(
    results: readonly { data?: { bars: readonly Bar[] } }[]
): (number | null)[] {
    return results.map(result =>
        result.data
            ? (quoteFromBars(result.data.bars)?.changePct ?? null)
            : null
    );
}

interface RowQuoteProps {
    symbol: string;
    enabled: boolean;
}

function RowQuote({ symbol, enabled }: RowQuoteProps) {
    const t = useTranslations('features.watchlist');
    const locale = useResolvedLocale();
    const { quote, isSettled } = useWatchlistQuote(symbol, enabled);
    if (!isSettled) {
        return (
            <span
                aria-hidden="true"
                className={cn(
                    'inline-block h-4 w-24 animate-pulse rounded',
                    PLACEHOLDER_ON_INSET
                )}
            />
        );
    }
    if (quote === null) {
        return (
            <span className="text-xs text-secondary-400">
                {t('section.quoteUnavailable')}
            </span>
        );
    }
    return (
        <dl className="flex items-baseline gap-3 text-sm tabular-nums">
            <div className="flex items-baseline gap-1">
                <dt className="sr-only">{t('section.price')}</dt>
                <dd className="text-secondary-100">
                    {formatCurrencyForSymbol(quote.price, symbol, locale)}
                </dd>
            </div>
            {quote.changePct !== null && (
                <div className="flex items-baseline gap-1">
                    <dt className="sr-only">{t('section.change')}</dt>
                    <dd className={signColorClass(quote.changePct)}>
                        {formatSignedPercent(quote.changePct)}
                    </dd>
                </div>
            )}
        </dl>
    );
}

interface WatchlistRowProps {
    item: WatchlistItemView;
    isMember: boolean;
    onRemove: (symbol: string) => void;
    onConvert: (input: RawHoldingInput) => Promise<SavePortfolioResult>;
    isSaving: boolean;
}

function WatchlistRow({
    item,
    isMember,
    onRemove,
    onConvert,
    isSaving,
}: WatchlistRowProps) {
    const t = useTranslations('features.watchlist');
    const [isConverting, setIsConverting] = useState(false);
    const [setNode, isVisible] = useInViewOnce<HTMLLIElement>();
    const assetLabel = useAssetLabel();
    // 카탈로그 한글명 → 저장된 회사명 → 심볼. 저장된 이름이 영문이라도 ko 화면은 한글명을 우선한다.
    const displayName = assetLabel(
        item.symbol,
        item.companyName ?? item.symbol
    );
    const name = symbolLabel(item.symbol, displayName);

    if (isConverting) {
        return (
            <li ref={setNode} className={WATCHLIST_ROW_CHROME}>
                <HoldingForm
                    defaultSymbol={item.symbol}
                    onSubmit={async input => {
                        const result = await onConvert(input);
                        if (result.status === 'ok') setIsConverting(false);
                        return result;
                    }}
                    submitting={isSaving}
                    onCancel={() => setIsConverting(false)}
                />
            </li>
        );
    }

    return (
        <li
            ref={setNode}
            className={cn(
                WATCHLIST_ROW_CHROME,
                'flex flex-wrap items-center justify-between gap-3'
            )}
        >
            <div className="min-w-0 flex-1">
                <Link
                    href={`/${item.symbol}`}
                    prefetch={false}
                    className={NAME_LINK}
                >
                    {name}
                </Link>
                <div className="mt-1">
                    <RowQuote symbol={item.symbol} enabled={isVisible} />
                </div>
            </div>
            <MiniTrend
                symbol={item.symbol}
                enabled={isVisible}
                className="hidden h-8 w-28 sm:block"
            />
            <div className="flex shrink-0 items-center gap-2">
                {isMember && (
                    <button
                        type="button"
                        onClick={() => setIsConverting(true)}
                        aria-label={t('section.convertFor', {
                            v0: item.symbol,
                        })}
                        className={ACTION_BUTTON}
                    >
                        {t('section.convert')}
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => onRemove(item.symbol)}
                    aria-label={t('section.removeFor', { v0: item.symbol })}
                    className={DANGER_BUTTON}
                >
                    {t('section.remove')}
                </button>
            </div>
        </li>
    );
}

/**
 * `/watchlist`의 관심 탭 목록. 비회원은 로컬 목록을 본다. 시세는 행이 뷰포트에 들어올 때만
 * 봉 캐시에서 파생한다(등락률 정렬을 고르면 그때 전부). "보유로 전환"은 회원만 —
 * `HoldingForm`을 심볼 채워 열고 저장 성공 시 관심 항목을 지운다.
 */
export function WatchlistSection({ sort = 'added' }: WatchlistSectionProps) {
    const t = useTranslations('features.watchlist');
    const { items, isHydrated, isIdentityPending, isMember, remove } =
        useWatchlist();
    const { showToast } = useToast();
    const { save } = usePortfolioHoldings({ enabled: false });
    const assetLabel = useAssetLabel();
    const locale = useResolvedLocale();
    const openSearch = useOpenTickerSearch();
    const changes = useQueries({
        queries: items.map(item => ({
            ...watchlistQuoteQuery(item.symbol),
            enabled: sort === 'change',
        })),
        combine: changesOf,
    });
    // `useQueries` 결과는 `queries`와 같은 순서다 — 심볼은 `items`에서 바로 짝짓는다.
    const changeBySymbol = new Map(
        items.map((item, index) => [item.symbol, changes[index] ?? null])
    );
    const sorted = sortWatchlistItems(items, sort, {
        nameOf: item =>
            assetLabel(item.symbol, item.companyName ?? item.symbol),
        changeOf: item => changeBySymbol.get(item.symbol) ?? null,
        locale,
    });

    const handleConvert = async (
        input: RawHoldingInput
    ): Promise<SavePortfolioResult> => {
        const result = await save.mutateAsync(input);
        if (result.status === 'ok') {
            // 보유는 이미 저장됐다. 관심 항목 삭제가 실패하면(훅이 띄운 일반 실패 토스트를 교체해)
            // 무엇이 됐고 무엇이 안 됐는지 구체적으로 알린다.
            if (!(await remove(result.holding.symbol))) {
                showToast({ message: t('toast.holdingKeptInWatchlist') });
            }
        }
        return result;
    };

    // 회원 여부를 모르는 동안의 빈 목록은 "계정에 없음"이 아니다 — 빈 상태 대신 로딩을 그린다.
    if (!isHydrated || (items.length === 0 && isIdentityPending)) {
        return (
            <div role="status" aria-busy="true" aria-live="polite">
                <span className="sr-only">{t('section.loading')}</span>
                <div className="space-y-2" aria-hidden="true">
                    {[0, 1].map(i => (
                        <div
                            key={i}
                            className={cn(
                                WATCHLIST_ROW_CHROME,
                                'h-16 animate-pulse'
                            )}
                        />
                    ))}
                </div>
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="rounded-lg border border-dashed border-secondary-700 px-4 py-8 text-center text-sm text-secondary-400">
                <p className="font-medium text-secondary-200">
                    {t('section.empty')}
                </p>
                <p className="mt-1">{t('home.emptyBody')}</p>
                <button
                    type="button"
                    onClick={openSearch}
                    className="mt-3 inline-flex min-h-11 items-center rounded px-2 font-semibold text-primary-400 transition-colors hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    {t('home.search')}
                </button>
            </div>
        );
    }

    return (
        <ul aria-label={t('section.list')} className="space-y-2">
            {sorted.map(item => (
                <WatchlistRow
                    key={item.symbol}
                    item={item}
                    isMember={isMember}
                    onRemove={symbol => void remove(symbol)}
                    onConvert={handleConvert}
                    isSaving={save.isPending}
                />
            ))}
        </ul>
    );
}
