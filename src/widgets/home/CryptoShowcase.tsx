import type { CryptoCategoryId } from '@/shared/lib/types';
import { CRYPTO_CATEGORIES } from '@/shared/config/crypto-categories';
import { CategoryCardGrid, type CategoryCard } from './ui/CategoryCardGrid';

const CRYPTO_STYLES: Record<
    CryptoCategoryId,
    { borderColor: string; textColor: string }
> = {
    major: {
        borderColor: 'border-l-primary-400',
        textColor: 'text-primary-400',
    },
    altcoin: {
        borderColor: 'border-l-chart-bullish',
        textColor: 'text-chart-bullish',
    },
};

export function CryptoShowcase() {
    const cards: CategoryCard[] = CRYPTO_CATEGORIES.map(category => ({
        id: category.id,
        label: category.label,
        borderColor: CRYPTO_STYLES[category.id].borderColor,
        textColor: CRYPTO_STYLES[category.id].textColor,
        items: category.items,
    }));

    return (
        <CategoryCardGrid
            heading="암호화폐 인기 종목"
            ariaLabel="암호화폐 인기 종목 탐색"
            cards={cards}
        />
    );
}
