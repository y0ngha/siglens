'use client';

import { useTranslations } from 'next-intl';
import type {
    RawHoldingInput,
    SavePortfolioResult,
} from '@/entities/portfolio/model';
import type { WatchlistItemView } from '@/entities/watchlist/model';
import { HoldingForm } from '@/features/portfolio-management/ui/HoldingForm';
import { WATCHLIST_ROW_CHROME } from '@/features/watchlist/lib/watchlistStyles';
import { MiniTrend } from '@/features/watchlist/ui/MiniQuoteRow';
import { useInViewOnce } from '@/shared/hooks/useInViewOnce';
import { useAssetLabel } from '@/shared/i18n/assetLabel';
import {
    BUTTON_OUTLINE,
    BUTTON_OUTLINE_DANGER,
} from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { symbolLabel } from '@/shared/lib/symbolLabel';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { useRowConvertMode } from '../../hooks/useRowConvertMode';
import { watchlistDisplayName } from '../../lib/watchlistDisplayName';
import { RowQuote } from './RowQuote';

const ACTION_BUTTON = cn(BUTTON_OUTLINE, 'px-3 py-1.5 text-xs');
const DANGER_BUTTON = cn(BUTTON_OUTLINE_DANGER, 'px-3 py-1.5 text-xs');
// `truncate`는 블록 상자에서만 잘린다 — 인라인 `<a>`는 긴 회사명이 칸을 넘어 버튼 위로 번진다.
// `w-fit`으로 클릭 영역은 글자 폭에 맞춘다.
const NAME_LINK =
    'block w-fit max-w-full truncate font-semibold text-secondary-100 transition-colors hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

interface WatchlistRowProps {
    item: WatchlistItemView;
    /** 회원에게만 "보유로 전환"을 보인다. */
    isMember: boolean;
    onRemove: (symbol: string) => void;
    /** 보유 저장. 성공하면 폼을 닫는다(관심 항목 삭제는 호출부가 맡는다). */
    onConvert: (input: RawHoldingInput) => Promise<SavePortfolioResult>;
    isSaving: boolean;
}

/**
 * 관심 탭의 한 행 — 종목 링크·시세·미니 차트·행 동작. 시세는 행이 뷰포트에 들어올 때 불러온다.
 * "보유로 전환"을 누르면 행 자리에 심볼이 채워진 `HoldingForm`이 열린다.
 */
export function WatchlistRow({
    item,
    isMember,
    onRemove,
    onConvert,
    isSaving,
}: WatchlistRowProps) {
    const t = useTranslations('features.watchlist');
    const [observeRow, isVisible] = useInViewOnce<HTMLLIElement>();
    const { isConverting, open, close, setRow, triggerRef } =
        useRowConvertMode(observeRow);
    const assetLabel = useAssetLabel();
    const name = symbolLabel(
        item.symbol,
        watchlistDisplayName(item, assetLabel)
    );

    if (isConverting) {
        return (
            <li ref={setRow} className={WATCHLIST_ROW_CHROME}>
                <HoldingForm
                    defaultSymbol={item.symbol}
                    onSubmit={async input => {
                        const result = await onConvert(input);
                        if (result.status === 'ok') close();
                        return result;
                    }}
                    submitting={isSaving}
                    onCancel={close}
                />
            </li>
        );
    }

    return (
        <li
            ref={setRow}
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
                <div className="mt-1 flex h-5 items-center">
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
                        ref={triggerRef}
                        type="button"
                        onClick={open}
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
