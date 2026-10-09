'use client';

import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import {
    KR_CATEGORY_IDS,
    TICKER_CATEGORIES,
} from '@/shared/config/popular-tickers';
import { TICKER_CATEGORY_LABEL_KEY } from '@/shared/config/tickerCategoryLabel';
import { WATCHLIST_ONBOARDING_COLLAPSE_COUNT } from '@/shared/config/watchlist';
import { useAssetLabel } from '@/shared/i18n/assetLabel';
import { DEFAULT_LOCALE } from '@/shared/i18n/locales';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import type { CategoryId } from '@/shared/lib/types';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { StarIcon } from '@/shared/ui/StrokeIcons';
import { useWatchlist } from '../hooks/useWatchlist';

/** 내 종목 빈 상태 링크(`WatchlistSection`)가 가리키는 앵커. */
export const WATCHLIST_ONBOARDING_ID = 'watchlist-onboarding';
const DEFAULT_CATEGORY: CategoryId = 'megacap';

const FOCUS_RING =
    'focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';
const CHIP = cn(
    'inline-flex min-h-11 items-center rounded-full border px-4 text-xs font-medium transition-colors',
    FOCUS_RING
);
const CHIP_IDLE =
    'border-border-control text-secondary-300 hover:border-primary-500 hover:text-secondary-100';
const CHIP_ACTIVE = 'border-primary-500 bg-primary-900/10 text-primary-300';

/*
 * 타일 = 토글 버튼(티커 + ☆), 회사명만 종목 링크. 한 `li` 안에 두 조작 요소를 겹치지 않는
 * 형제로 위아래에 둔다(네이티브 중첩 금지) — 버튼이 먼저라 포커스 순서가 타일→링크다.
 * 테두리·눌림 색은 `li`가 쥐어 시각적으로는 한 타일로 읽히고, 두 요소 모두 높이 44px 이상이다.
 */
const TILE = 'flex flex-col rounded-lg border transition-colors';
const TILE_IDLE =
    'border-border-control text-secondary-300 hover:border-primary-500';
const TILE_PRESSED = 'border-primary-500 bg-primary-900/10 text-primary-300';
const TILE_BUTTON = cn(
    'flex min-h-11 w-full items-center justify-between gap-2 rounded-t-lg px-3 text-left',
    FOCUS_RING,
    'disabled:cursor-not-allowed disabled:text-secondary-500 aria-disabled:cursor-not-allowed aria-disabled:text-secondary-500'
);
const TILE_LINK = cn(
    'flex min-h-11 items-center rounded-b-lg px-3 text-sm font-semibold text-secondary-100 transition-colors hover:text-primary-300',
    FOCUS_RING
);
const VIEW_MINE = cn(
    'rounded font-semibold text-primary-400 transition-colors hover:text-primary-300',
    FOCUS_RING
);

/**
 * 홈 히어로 아래 온보딩 블록(§6.2). 서버 렌더는 항상 펼친 상태(비회원 SEO 콘텍스트 유지),
 * 접힘(담은 개수 ≥ 3)은 하이드레이션 뒤 클라이언트에서만 적용된다. 회원도 같은 블록을 본다.
 * 광고 랜딩(`/lp/*`)에는 두지 않는다.
 */
export function WatchlistOnboarding() {
    const [selected, setSelected] = useState<CategoryId>(DEFAULT_CATEGORY);
    const [expanded, setExpanded] = useState(false);
    const headingId = useId();
    const idPrefix = useId();
    const limitId = `${idPrefix}-limit`;
    const t = useTranslations('features.watchlist');
    const tCategory = useTranslations('widgets.home');
    const locale = useResolvedLocale();
    const assetLabel = useAssetLabel();
    const { items, has, toggle, isHydrated, isAtLimit, limit } = useWatchlist();

    // KR 카테고리는 ko에서만(`TickerCategories`의 `KR_CATEGORY_IDS` 규칙과 같다).
    const categories =
        locale === DEFAULT_LOCALE
            ? TICKER_CATEGORIES
            : TICKER_CATEGORIES.filter(
                  category => !KR_CATEGORY_IDS.has(category.id)
              );
    const current =
        categories.find(category => category.id === selected) ?? categories[0];
    const categoryLabel = (label: string): string => {
        const key = TICKER_CATEGORY_LABEL_KEY[label];
        return key ? tCategory(key) : label;
    };
    const count = items.length;
    const collapsed =
        isHydrated && count >= WATCHLIST_ONBOARDING_COLLAPSE_COUNT && !expanded;

    if (collapsed) {
        return (
            <section
                id={WATCHLIST_ONBOARDING_ID}
                aria-label={t('onboarding.title')}
                className={cn(
                    SURFACE_CARD,
                    'flex flex-wrap items-center justify-between gap-3 px-5 py-2'
                )}
            >
                <button
                    type="button"
                    aria-expanded={false}
                    onClick={() => setExpanded(true)}
                    className={cn(
                        'inline-flex min-h-11 items-center gap-2 rounded text-sm font-medium text-secondary-100',
                        FOCUS_RING
                    )}
                >
                    <StarIcon filled className="size-4 text-primary-400" />
                    {t('onboarding.collapsed', { v0: count })}
                </button>
                <Link
                    href="/portfolio"
                    prefetch={false}
                    className={cn(VIEW_MINE, 'text-sm')}
                >
                    {t('onboarding.viewMine')} <span aria-hidden="true">→</span>
                </Link>
            </section>
        );
    }

    if (!current) return null;

    return (
        <section
            id={WATCHLIST_ONBOARDING_ID}
            aria-labelledby={headingId}
            className={cn(SURFACE_CARD, 'space-y-5 p-5 sm:p-6')}
        >
            <div>
                <h2 id={headingId} className={HEADING_SECTION}>
                    {t('onboarding.title')}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-secondary-400">
                    {t('onboarding.subtitle')}
                </p>
            </div>

            <div
                role="group"
                aria-label={t('onboarding.categories')}
                className="flex flex-wrap gap-2"
            >
                {categories.map(category => {
                    const isActive = category.id === current.id;
                    return (
                        <button
                            key={category.id}
                            type="button"
                            aria-pressed={isActive}
                            onClick={() => setSelected(category.id)}
                            className={cn(
                                CHIP,
                                isActive ? CHIP_ACTIVE : CHIP_IDLE
                            )}
                        >
                            {categoryLabel(category.label)}
                        </button>
                    );
                })}
            </div>

            <ul
                aria-label={t('onboarding.tiles', {
                    v0: categoryLabel(current.label),
                })}
                className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
            >
                {current.items.map(item => {
                    const label = assetLabel(item.symbol, item.name);
                    const pressed = isHydrated && has(item.symbol);
                    const blockedByLimit = isHydrated && !pressed && isAtLimit;
                    const linkId = `${idPrefix}-${item.symbol}`;
                    return (
                        <li
                            key={item.symbol}
                            className={cn(
                                TILE,
                                pressed ? TILE_PRESSED : TILE_IDLE
                            )}
                        >
                            <button
                                type="button"
                                aria-pressed={pressed}
                                aria-label={
                                    pressed
                                        ? t('toggle.remove')
                                        : t('toggle.add')
                                }
                                aria-describedby={
                                    blockedByLimit
                                        ? `${linkId} ${limitId}`
                                        : linkId
                                }
                                disabled={!isHydrated}
                                aria-disabled={blockedByLimit || undefined}
                                onClick={() => {
                                    // 상한은 aria-disabled라 포커스는 받는다 — 클릭만 막는다.
                                    if (blockedByLimit) return;
                                    void toggle(
                                        { symbol: item.symbol, label },
                                        'home_onboarding'
                                    );
                                }}
                                className={TILE_BUTTON}
                            >
                                <span className="text-xs tabular-nums">
                                    {item.symbol}
                                </span>
                                <StarIcon
                                    filled={pressed}
                                    className="size-4 shrink-0"
                                />
                            </button>
                            <Link
                                id={linkId}
                                href={`/${item.symbol}`}
                                prefetch={false}
                                className={TILE_LINK}
                            >
                                <span className="truncate">{label}</span>
                            </Link>
                        </li>
                    );
                })}
            </ul>

            {isAtLimit && (
                <span id={limitId} className="sr-only">
                    {t('toggle.limit', { v0: limit })}
                </span>
            )}

            {isHydrated && count > 0 && (
                <p className="text-sm text-secondary-300">
                    {t('onboarding.count', { v0: count })}
                    <span aria-hidden="true" className="text-secondary-500">
                        {' · '}
                    </span>
                    <Link
                        href="/portfolio"
                        prefetch={false}
                        className={VIEW_MINE}
                    >
                        {t('onboarding.viewMine')}{' '}
                        <span aria-hidden="true">→</span>
                    </Link>
                </p>
            )}
        </section>
    );
}
