import { useTranslations } from 'next-intl';
import { useAssetLabel } from '@/shared/i18n/assetLabel';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';

import type { TickerItem } from '@/shared/lib/types';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';

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
    items: readonly TickerItem[];
}

interface CategoryCardGridProps {
    heading: string;
    ariaLabel: string;
    cards: readonly CategoryCard[];
}

// 주식(섹터)·암호화폐 두 섹션이 동일한 카드 디자인을 공유하도록 추출한
// 순수 프레젠테이션 컴포넌트.
export function CategoryCardGrid({
    heading,
    ariaLabel,
    cards,
}: CategoryCardGridProps) {
    const t = useTranslations('widgets.home');
    const assetLabel = useAssetLabel();
    return (
        <nav aria-label={ariaLabel} className="page-container py-10">
            {/* 같은 위계의 h2는 `HEADING_SECTION` 한 곳에서만 정의한다
                (`shared/lib/typographyStyles.ts`). 한글 제목이라 uppercase·넓은
                자간을 쓰지 않는 근거도 그 상수의 주석에 있다. */}
            <h2 className={cn('mb-6', HEADING_SECTION)}>{heading}</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {cards.map(card => (
                    <div
                        key={card.id}
                        id={card.id}
                        className={cn(
                            'border-secondary-700 bg-secondary-800/50 scroll-mt-20 rounded-lg border p-5',
                            'border-l-2',
                            card.borderColor
                        )}
                    >
                        <h3
                            className={cn(
                                'mb-3 text-sm font-semibold tracking-[0.01em]',
                                card.textColor
                            )}
                        >
                            {card.labelKey ? t(card.labelKey) : card.label}
                        </h3>
                        <ul
                            className="flex touch-manipulation flex-wrap gap-2"
                            aria-label={t('CategoryCardGrid.tickerListLabel', {
                                v0: card.labelKey
                                    ? t(card.labelKey)
                                    : card.label,
                            })}
                        >
                            {card.items.map(item => (
                                <li key={item.symbol}>
                                    <Link
                                        href={`/${item.symbol}`}
                                        title={t(
                                            'CategoryCardGrid.analyzeTitle',
                                            { v0: item.symbol }
                                        )}
                                        // 랜딩 그리드는 종목 링크를 수십 개 렌더한다.
                                        // 스크롤만 해도 그 수만큼 1.7MB짜리 RSC 페이로드를
                                        // origin에서 당겨오므로 prefetch를 끈다
                                        // (docs/architecture/CDN_CACHING.md §1).
                                        prefetch={false}
                                        className="inline-flex items-baseline gap-1.5 rounded-full border border-border-control px-3 py-1 text-xs text-secondary-300 transition-colors hover:border-primary-500 hover:text-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
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
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </nav>
    );
}
