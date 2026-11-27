/**
 * 카테고리 카드 그리드 본체의 타입과 렌더 — 데이터는 `toCategoryCards`가 만들어 넘긴다.
 * 제목·`nav` 랜드마크·탭은 `PopularTickers`가 소유한다(이 파일은 카드 격자만 그린다).
 */

import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { useTranslations } from 'next-intl';
import type { WatchlistSource } from '@/entities/watchlist/model';
import { WatchlistPillScope } from '@/features/watchlist/ui/WatchlistPillScope';
import { WatchlistPillToggle } from '@/features/watchlist/ui/WatchlistPillToggle';
import { useAssetLabel } from '@/shared/i18n/assetLabel';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';

import type { TickerItem } from '@/shared/lib/types';
import { cn } from '@/shared/lib/cn';
import { COLLAPSED_VISIBLE } from '../utils/popularCollapse';

/** 카드 좌측 보더 + 라벨 텍스트의 Tailwind 색상 클래스 쌍. */
export interface CardStyle {
    /** Tailwind left-border 색상 클래스, 예: 'border-l-primary-400' */
    borderColor: string;
    /** Tailwind 텍스트 색상 클래스, 예: 'text-primary-400' */
    textColor: string;
}

export interface CategoryCard extends CardStyle {
    id: string;
    label: string;
    /**
     * 표시용 메시지 키. 없으면 `label`(한국어 원문)로 떨어진다 — 새 카테고리가
     * 등록 없이 들어와도 화면이 비지 않는다.
     */
    labelKey?: string;
    /** 카드 제목 아래 한 줄 설명의 메시지 키. 없으면 설명을 그리지 않는다. */
    descriptionKey?: string;
    items: readonly TickerItem[];
}

/**
 * 접힌 패널(`group/grid`의 `data-collapsed="true"`)에서 카드를 숨기는 클래스. DOM에서 빼지 않고
 * `display:none`만 건다 — 숨은 카드의 종목 링크도 서버 HTML에 남아야 크롤러가 따라간다.
 * Tailwind가 소스에서 클래스를 찾으므로 문자열은 리터럴로 둔다(템플릿으로 조립하지 않는다).
 */
function collapsedCardClass(index: number): string | undefined {
    if (index < COLLAPSED_VISIBLE.base) return undefined;
    if (index < COLLAPSED_VISIBLE.md) {
        return 'group-data-[collapsed=true]/grid:max-md:hidden';
    }
    if (index < COLLAPSED_VISIBLE.lg) {
        return 'group-data-[collapsed=true]/grid:max-lg:hidden';
    }
    return 'group-data-[collapsed=true]/grid:hidden';
}

interface CategoryCardGridBodyProps {
    cards: readonly CategoryCard[];
    /** 있으면 종목 알약마다 관심종목 ★를 붙이고 이 값으로 담기 지점을 기록한다. */
    watchlistSource?: WatchlistSource;
}

/**
 * 카테고리 카드 격자 — 미국·한국·암호화폐 패널이 같은 카드 디자인을 공유하는 프레젠테이션
 * 컴포넌트. 접기는 조상의 `group/grid` + `data-collapsed`가 켠다(서버 컴포넌트라 상태가 없다).
 * 카드에 DOM id를 달지 않는다: 카테고리 id는 패널 간에 겹칠 수 있어 문서 전체에서 유일하다고
 * 보장할 수 없다.
 */
export function CategoryCardGridBody({
    cards,
    watchlistSource,
}: CategoryCardGridBodyProps) {
    const t = useTranslations('widgets.home');
    const assetLabel = useAssetLabel();
    const grid = (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {cards.map((card, index) => {
                const title = card.labelKey ? t(card.labelKey) : card.label;
                return (
                    <div
                        key={card.id}
                        className={cn(
                            SURFACE_CARD,
                            'p-5',
                            'border-l-2',
                            card.borderColor,
                            collapsedCardClass(index)
                        )}
                    >
                        <h3
                            className={cn(
                                'mb-3 text-sm font-semibold tracking-[0.01em]',
                                card.textColor
                            )}
                        >
                            {title}
                        </h3>
                        {card.descriptionKey && (
                            <p className="mb-3 text-xs leading-relaxed text-secondary-400">
                                {t(card.descriptionKey)}
                            </p>
                        )}
                        <ul
                            className="flex touch-manipulation flex-wrap gap-2"
                            aria-label={t('CategoryCardGrid.tickerListLabel', {
                                v0: title,
                            })}
                        >
                            {card.items.map(item => (
                                <li
                                    key={item.symbol}
                                    className={
                                        watchlistSource
                                            ? 'inline-flex items-center rounded-full border border-border-control transition-colors hover:border-primary-500'
                                            : undefined
                                    }
                                >
                                    <Link
                                        href={`/${item.symbol}`}
                                        title={t(
                                            'CategoryCardGrid.analyzeTitle',
                                            { v0: item.symbol }
                                        )}
                                        // 랜딩 그리드는 종목 링크를 수십 개 렌더한다.
                                        // 스크롤만 해도 그 수만큼 1.7MB짜리 RSC 페이로드를
                                        // origin에서 당겨오므로 prefetch를 끈다.
                                        prefetch={false}
                                        className={cn(
                                            'inline-flex items-baseline gap-1.5 rounded-full py-1 text-xs text-secondary-300 transition-colors hover:text-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none',
                                            // ★가 붙으면 테두리는 알약(`li`)이 갖고 링크는 왼쪽 몫만 쓴다.
                                            watchlistSource
                                                ? 'pr-0.5 pl-3'
                                                : 'border border-border-control px-3 hover:border-primary-500'
                                        )}
                                    >
                                        {/* config의 `name`은 한국어 데이터다 —
                                                표시는 `shared.assetName` 카탈로그를
                                                심볼로 조회한다(`useAssetLabel`). */}
                                        <span>
                                            {assetLabel(item.symbol, item.name)}
                                        </span>
                                        <span className="text-[10px] text-secondary-500">
                                            {item.symbol}
                                        </span>
                                    </Link>
                                    {watchlistSource && (
                                        <WatchlistPillToggle
                                            symbol={item.symbol}
                                            label={assetLabel(
                                                item.symbol,
                                                item.name
                                            )}
                                            source={watchlistSource}
                                        />
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                );
            })}
        </div>
    );
    return watchlistSource ? (
        // ★들이 관심종목 상태를 그리드 단위로 한 번만 구독하게 한다(WatchlistPillScope).
        <WatchlistPillScope>{grid}</WatchlistPillScope>
    ) : (
        grid
    );
}
