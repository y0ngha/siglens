import type { CategoryId } from '@/shared/lib/types';
import { TICKER_CATEGORIES } from '@/shared/config/popular-tickers';
import { CategoryCardGrid, type CategoryCard } from './ui/CategoryCardGrid';

const CATEGORY_STYLES: Record<
    CategoryId,
    { borderColor: string; textColor: string }
> = {
    megacap: {
        borderColor: 'border-l-primary-400',
        textColor: 'text-primary-400',
    },
    'ai-semiconductor': {
        borderColor: 'border-l-chart-bullish',
        textColor: 'text-chart-bullish',
    },
    'software-cloud': {
        borderColor: 'border-l-primary-300',
        textColor: 'text-primary-300',
    },
    'fintech-crypto': {
        borderColor: 'border-l-primary-500',
        textColor: 'text-primary-500',
    },
    'leveraged-etf': {
        borderColor: 'border-l-ui-warning',
        textColor: 'text-ui-warning',
    },
    'healthcare-bio': {
        borderColor: 'border-l-secondary-400',
        textColor: 'text-secondary-400',
    },
    'quantum-computing': {
        borderColor: 'border-l-primary-200',
        textColor: 'text-primary-200',
    },
    space: {
        borderColor: 'border-l-primary-100',
        textColor: 'text-primary-100',
    },
    'ev-mobility': {
        borderColor: 'border-l-secondary-300',
        textColor: 'text-secondary-300',
    },
    'energy-industrial': {
        borderColor: 'border-l-chart-bearish',
        textColor: 'text-chart-bearish',
    },
};

export function TickerCategories() {
    const cards: CategoryCard[] = TICKER_CATEGORIES.map(category => ({
        id: category.id,
        label: category.label,
        borderColor: CATEGORY_STYLES[category.id].borderColor,
        textColor: CATEGORY_STYLES[category.id].textColor,
        items: category.items,
    }));

    return (
        <CategoryCardGrid
            heading="섹터별 인기 종목"
            ariaLabel="섹터별 인기 종목 탐색"
            cards={cards}
        />
    );
}
