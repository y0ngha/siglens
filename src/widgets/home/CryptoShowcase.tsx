import { useTranslations } from 'next-intl';
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
        borderColor: 'border-l-secondary-300',
        textColor: 'text-secondary-300',
    },
};

const CRYPTO_CARDS: CategoryCard[] = CRYPTO_CATEGORIES.map(category => ({
    id: category.id,
    label: category.label,
    ...CRYPTO_STYLES[category.id],
    items: category.items,
}));

export function CryptoShowcase() {
    const t = useTranslations('widgets.home');
    return (
        <CategoryCardGrid
            heading={t('CryptoShowcase.5c8e33')}
            ariaLabel={t('CryptoShowcase.ab6a33')}
            cards={CRYPTO_CARDS}
        />
    );
}
