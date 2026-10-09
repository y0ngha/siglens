'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useCurrentUser } from '@/entities/auth/hooks/useCurrentUser';
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
import { useWatchlist } from '../hooks/useWatchlist';
import { useWatchlistQuote } from '../hooks/useWatchlistQuote';
import { WATCHLIST_ONBOARDING_ID } from './WatchlistOnboarding';

const ROW_CHROME =
    'ring-secondary-700 bg-secondary-900/60 rounded-lg p-4 ring-1';
const ACTION_BUTTON = cn(BUTTON_OUTLINE, 'px-3 py-1.5 text-xs');
const DANGER_BUTTON = cn(BUTTON_OUTLINE_DANGER, 'px-3 py-1.5 text-xs');
const NAME_LINK =
    'truncate font-semibold text-secondary-100 transition-colors hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

interface WatchlistSectionProps {
    /** 보유로 전환이 저장에 성공한 뒤. `/portfolio`는 서버가 그린 보유 카드를 다시 읽는다(`router.refresh`). */
    onHoldingsChange?: () => void;
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
            <li ref={setNode} className={ROW_CHROME}>
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
                ROW_CHROME,
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
 * 내 종목 페이지의 관심종목 섹션(§6.3). 비회원은 로컬 목록을 본다. 시세는 행이 뷰포트에
 * 들어올 때만 봉 캐시에서 파생한다. "보유로 전환"은 회원만 — `HoldingForm`을 심볼 채워 열고
 * 저장 성공 시 관심 항목을 지운다. 제목(h2)은 페이지가 그린다.
 */
export function WatchlistSection({ onHoldingsChange }: WatchlistSectionProps) {
    const t = useTranslations('features.watchlist');
    const { items, isHydrated, isIdentityPending, remove } = useWatchlist();
    const { data: currentUser } = useCurrentUser();
    const { save } = usePortfolioHoldings({ enabled: false });
    const isMember = currentUser != null;

    const handleConvert = async (
        input: RawHoldingInput
    ): Promise<SavePortfolioResult> => {
        const result = await save.mutateAsync(input);
        if (result.status === 'ok') {
            await remove(result.holding.symbol);
            onHoldingsChange?.();
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
                            className={cn(ROW_CHROME, 'h-16 animate-pulse')}
                        />
                    ))}
                </div>
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="rounded-lg border border-dashed border-secondary-700 px-4 py-6 text-center text-sm text-secondary-400">
                <p>{t('section.empty')}</p>
                <Link
                    href={`/#${WATCHLIST_ONBOARDING_ID}`}
                    prefetch={false}
                    className="mt-2 inline-block font-semibold text-primary-400 transition-colors hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    {t('section.emptyCta')}
                </Link>
            </div>
        );
    }

    return (
        <ul aria-label={t('section.list')} className="space-y-2">
            {items.map(item => (
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
