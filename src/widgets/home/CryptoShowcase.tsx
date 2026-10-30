/**
 * 홈 암호화폐 인기 종목 섹션: 카테고리별 색 매핑만 소유하고 렌더는 `CategoryCardGrid`에 맡긴다.
 */

import { useTranslations } from 'next-intl';
import type { CryptoCategoryId } from '@/shared/lib/types';
import { CRYPTO_CATEGORIES } from '@/shared/config/crypto-categories';
import { CategoryCardGrid, type CardStyle } from './ui/CategoryCardGrid';
import { toCategoryCards } from './utils/toCategoryCards';

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

const CRYPTO_CARDS = toCategoryCards(CRYPTO_CATEGORIES, CRYPTO_STYLES);

/** 홈의 암호화폐 인기 종목 섹션 — 설정 카테고리를 카드 그리드로 그린다. */
export function CryptoShowcase() {
    const t = useTranslations('widgets.home');
    return (
        <CategoryCardGrid
            heading={t('CryptoShowcase.5c8e33')}
            ariaLabel={t('CryptoShowcase.ab6a33')}
            cards={CRYPTO_CARDS}
            watchlistSource="home_popular"
        />
    );
}
