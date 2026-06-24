import type { CategoryId } from '@/shared/lib/types';
import { TICKER_CATEGORIES } from '@/shared/config/popular-tickers';
import {
    CategoryCardGrid,
    type CategoryCard,
    type CardStyle,
} from './ui/CategoryCardGrid';

const CATEGORY_STYLES: Record<CategoryId, CardStyle> = {
    megacap: {
        borderColor: 'border-l-primary-400',
        textColor: 'text-primary-400',
    },
    'ai-semiconductor': {
        borderColor: 'border-l-ui-success',
        textColor: 'text-ui-success',
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
        borderColor: 'border-l-ui-danger',
        textColor: 'text-ui-danger',
    },
};

const TICKER_CARDS: CategoryCard[] = TICKER_CATEGORIES.map(category => ({
    id: category.id,
    label: category.label,
    ...CATEGORY_STYLES[category.id],
    items: category.items,
}));

export function TickerCategories() {
    return (
        <CategoryCardGrid
            heading="섹터별 인기 종목"
            ariaLabel="섹터별 인기 종목 탐색"
            cards={TICKER_CARDS}
        />
    );
}
