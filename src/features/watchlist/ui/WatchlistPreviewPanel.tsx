'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { WATCHLIST_PREVIEW_COUNT } from '@/shared/config/watchlist';
import { cn } from '@/shared/lib/cn';
import { PLACEHOLDER_ON_CARD } from '@/shared/lib/surfaceStyles';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import type { WatchlistPreviewItem } from '../hooks/useWatchlistPreview';
import { useWatchlistPreviewTabs } from '../hooks/useWatchlistPreviewTabs';
import { WATCHLIST_SUBTLE_LINK } from '../lib/watchlistStyles';
import {
    watchlistPageHref,
    watchlistPanelId,
    watchlistTabId,
    type WatchlistPreviewTab,
} from '../lib/watchlistTabs';
import { MiniQuoteRow } from './MiniQuoteRow';
import { WatchlistTabs } from './WatchlistTabs';

interface WatchlistPreviewPanelProps {
    /**
     * `popover`(PC): 최대 `WATCHLIST_PREVIEW_COUNT`행, 넘치면 "전체 보기"로.
     * `sheet`(모바일): 전부 그리고 목록 영역만 스크롤한다 — 시트 높이는 바깥이 고정한다.
     */
    variant: 'popover' | 'sheet';
    /** 열려 있을 때만 true — 닫힌 팝오버가 시세를 요청하지 않게 한다. */
    quotesEnabled: boolean;
    /** 행·링크를 눌러 다른 페이지로 갈 때 팝오버·시트를 닫는다. */
    onNavigate: () => void;
}

interface PanelBodyProps {
    isReady: boolean;
    rows: WatchlistPreviewItem[];
    tab: WatchlistPreviewTab;
    quotesEnabled: boolean;
    onNavigate: () => void;
}

/** 패널 본문의 세 상태: 확인 중(로딩) / 비어 있음 / 목록. */
function PanelBody({
    isReady,
    rows,
    tab,
    quotesEnabled,
    onNavigate,
}: PanelBodyProps) {
    const t = useTranslations('features.watchlist');
    // 키는 정적으로 적는다 — i18n 추출기가 동적 조회(`t(map[tab])`)를 못 봐서 헤더 라우트
    // 카탈로그에서 문구가 빠진다.
    const isWatchlistTab = tab === 'watchlist';
    if (!isReady) {
        return (
            <div
                role="status"
                aria-busy="true"
                className="space-y-1 px-1.5 py-1"
            >
                <span className="sr-only">{t('section.loading')}</span>
                {[0, 1, 2].map(i => (
                    <div
                        key={i}
                        aria-hidden="true"
                        className={cn(
                            'h-12 animate-pulse rounded-lg',
                            PLACEHOLDER_ON_CARD
                        )}
                    />
                ))}
            </div>
        );
    }
    if (rows.length === 0) {
        return (
            <p className="px-3 py-8 text-center text-sm leading-relaxed text-secondary-400">
                {isWatchlistTab
                    ? t('preview.emptyWatchlist')
                    : t('preview.emptyRecent')}
            </p>
        );
    }
    return (
        <ul
            aria-label={
                isWatchlistTab
                    ? t('preview.tabWatchlist')
                    : t('preview.tabRecent')
            }
        >
            {rows.map(item => (
                <MiniQuoteRow
                    key={item.symbol}
                    item={item}
                    quotesEnabled={quotesEnabled}
                    onNavigate={onNavigate}
                />
            ))}
        </ul>
    );
}

/**
 * 헤더 ★가 여는 관심종목 미리보기. PC 팝오버와 모바일 시트가 같은 본문을 쓴다.
 * 헤더(탭·편집)와 바닥 링크는 고정이고 목록만 스크롤한다.
 */
export function WatchlistPreviewPanel({
    variant,
    quotesEnabled,
    onNavigate,
}: WatchlistPreviewPanelProps) {
    const t = useTranslations('features.watchlist');
    const idBase = useId();
    const {
        watchlist,
        isReady,
        tab,
        selectTab,
        rows: all,
    } = useWatchlistPreviewTabs();
    const rows =
        variant === 'popover' ? all.slice(0, WATCHLIST_PREVIEW_COUNT) : all;

    return (
        <div
            className={cn(
                'flex flex-col',
                variant === 'sheet' && 'min-h-0 flex-1'
            )}
        >
            <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-1">
                <WatchlistTabs
                    value={tab}
                    onChange={selectTab}
                    watchlistCount={isReady ? watchlist.length : null}
                    idBase={idBase}
                    size={variant === 'sheet' ? 'md' : 'sm'}
                />
                {tab === 'watchlist' && watchlist.length > 0 && (
                    <Link
                        href="/watchlist"
                        prefetch={false}
                        onClick={onNavigate}
                        className={WATCHLIST_SUBTLE_LINK}
                    >
                        {t('preview.edit')}
                    </Link>
                )}
            </div>
            <div
                role="tabpanel"
                id={watchlistPanelId(idBase)}
                aria-labelledby={watchlistTabId(idBase, tab)}
                className={cn(
                    'overscroll-contain px-1.5 pb-1.5',
                    variant === 'sheet'
                        ? 'min-h-0 flex-1 overflow-y-auto'
                        : 'max-h-[min(60vh,26rem)] overflow-y-auto'
                )}
            >
                <PanelBody
                    isReady={isReady}
                    rows={rows}
                    tab={tab}
                    quotesEnabled={quotesEnabled}
                    onNavigate={onNavigate}
                />
            </div>
            <div
                className={cn(
                    'border-t border-secondary-700',
                    variant === 'sheet' &&
                        'p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]'
                )}
            >
                <Link
                    href={watchlistPageHref(tab)}
                    prefetch={false}
                    onClick={onNavigate}
                    className={cn(
                        'flex touch-manipulation items-center justify-center text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none',
                        variant === 'sheet'
                            ? 'h-12 rounded-lg bg-primary-600 text-white hover:bg-primary-700'
                            : 'h-12 text-primary-400 hover:text-primary-300'
                    )}
                >
                    {t('preview.viewAll')}
                </Link>
            </div>
        </div>
    );
}
