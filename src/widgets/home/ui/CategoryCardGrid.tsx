import Link from 'next/link';

import type { TickerItem } from '@/shared/lib/types';
import { cn } from '@/shared/lib/cn';

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
    return (
        <nav
            aria-label={ariaLabel}
            className="px-6 py-10 lg:pr-[10vw] lg:pl-[15vw]"
        >
            <h2 className="text-secondary-200 mb-6 text-sm font-semibold tracking-wider uppercase">
                {heading}
            </h2>
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
                                'mb-3 text-xs font-semibold tracking-wider uppercase',
                                card.textColor
                            )}
                        >
                            {card.label}
                        </h3>
                        <ul
                            className="flex touch-manipulation flex-wrap gap-2"
                            aria-label={`${card.label} 종목 목록`}
                        >
                            {card.items.map(item => (
                                <li key={item.symbol}>
                                    <Link
                                        href={`/${item.symbol}`}
                                        title={`${item.symbol} 분석`}
                                        className="border-secondary-700 text-secondary-300 hover:border-primary-600/40 hover:text-primary-400 focus-visible:ring-primary-500 inline-flex items-baseline gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
                                    >
                                        <span>{item.name}</span>
                                        <span className="text-secondary-500 text-[10px]">
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
