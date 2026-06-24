import type { CryptoCategoryId } from '@/shared/lib/types';
import { CRYPTO_CATEGORIES } from '@/shared/config/crypto-categories';
import {
    CategoryCardGrid,
    type CategoryCard,
    type CardStyle,
} from './ui/CategoryCardGrid';

const CRYPTO_STYLES: Record<CryptoCategoryId, CardStyle> = {
    major: {
        borderColor: 'border-l-primary-400',
        textColor: 'text-primary-400',
    },
    altcoin: {
        borderColor: 'border-l-ui-success',
        textColor: 'text-ui-success',
    },
};

const CRYPTO_CARDS: CategoryCard[] = CRYPTO_CATEGORIES.map(category => ({
    id: category.id,
    label: category.label,
    ...CRYPTO_STYLES[category.id],
    items: category.items,
}));

export function CryptoShowcase() {
    return (
        <CategoryCardGrid
            heading="암호화폐 인기 종목"
            ariaLabel="암호화폐 인기 종목 탐색"
            cards={CRYPTO_CARDS}
        />
    );
}
