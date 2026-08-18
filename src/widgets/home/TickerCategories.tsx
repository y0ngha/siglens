import type { CategoryId } from '@/shared/lib/types';
import {
    KR_CATEGORY_IDS,
    TICKER_CATEGORIES,
} from '@/shared/config/popular-tickers';
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
        borderColor: 'border-l-primary-300',
        textColor: 'text-primary-300',
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
        borderColor: 'border-l-secondary-500',
        textColor: 'text-secondary-500',
    },
    'kr-semiconductor': {
        borderColor: 'border-l-primary-400',
        textColor: 'text-primary-400',
    },
    'kr-auto-battery': {
        borderColor: 'border-l-primary-300',
        textColor: 'text-primary-300',
    },
    'kr-bio': {
        borderColor: 'border-l-secondary-400',
        textColor: 'text-secondary-400',
    },
    'kr-platform': {
        borderColor: 'border-l-primary-500',
        textColor: 'text-primary-500',
    },
    'kr-finance': {
        borderColor: 'border-l-secondary-300',
        textColor: 'text-secondary-300',
    },
    'kr-kosdaq': {
        borderColor: 'border-l-secondary-500',
        textColor: 'text-secondary-500',
    },
};

const TICKER_CARDS: CategoryCard[] = TICKER_CATEGORIES.map(category => ({
    id: category.id,
    label: category.label,
    ...CATEGORY_STYLES[category.id],
    items: category.items,
}));

/**
 * 미국·한국을 별도 섹션으로 나눈다.
 *
 * 업종 라벨만 보면 어느 시장인지 알 수 없다 — `반도체·IT`(한국)와
 * `AI·반도체`(미국)가 한 그리드에 섞여 있으면 사용자는 구분할 방법이 없다.
 * 라벨마다 "한국"을 붙이는 대신 섹션 제목에서 한 번만 밝힌다.
 */
const isKrCard = (card: CategoryCard) =>
    KR_CATEGORY_IDS.has(card.id as CategoryId);
const US_CARDS = TICKER_CARDS.filter(c => !isKrCard(c));
const KR_CARDS = TICKER_CARDS.filter(isKrCard);

export function TickerCategories() {
    return (
        <>
            <CategoryCardGrid
                heading="미국 섹터별 인기 종목"
                ariaLabel="미국 섹터별 인기 종목 탐색"
                cards={US_CARDS}
            />
            {/* KR 카테고리가 비어 있으면 제목만 남은 빈 섹션이 된다. */}
            {KR_CARDS.length > 0 && (
                <CategoryCardGrid
                    heading="한국 섹터별 인기 종목"
                    ariaLabel="한국 섹터별 인기 종목 탐색"
                    cards={KR_CARDS}
                />
            )}
        </>
    );
}
