/**
 * 홈 인기 종목 섹션 — 미국 주식·한국 주식·암호화폐를 시장 탭 하나로 묶는다.
 *
 * 세 섹션(약 5,000px)을 한 영역으로 줄이되 **종목 링크는 하나도 빼지 않는다**: 패널을 전부 서버에서
 * 그려 클라이언트 탭 래퍼에 노드로 넘기므로(`PopularTickerTabs`), 비활성 탭과 접힌 카드의 링크도
 * 서버 HTML에 있다. 카테고리별 색 매핑과 시장 분할을 소유하고 격자는 `CategoryCardGridBody`가 그린다.
 */

import { useTranslations } from 'next-intl';
import { HOME_POPULAR_ANCHOR_ID } from '@/shared/config/watchlist';
import { CRYPTO_CATEGORIES } from '@/shared/config/crypto-categories';
import {
    KR_CATEGORY_IDS,
    TICKER_CATEGORIES,
} from '@/shared/config/popular-tickers';
import { cn } from '@/shared/lib/cn';
import type { CategoryId, CryptoCategoryId } from '@/shared/lib/types';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import {
    CategoryCardGridBody,
    type CardStyle,
    type CategoryCard,
} from './ui/CategoryCardGrid';
import { PopularTickerTabs, type PopularPanel } from './ui/PopularTickerTabs';
import { toCategoryCards } from './utils/toCategoryCards';

const HEADING_ID = 'home-popular-heading';

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
        textColor: 'text-ui-warning-text',
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
    'kr-trending': {
        borderColor: 'border-l-primary-400',
        textColor: 'text-primary-400',
    },
};

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

const TICKER_CARDS = toCategoryCards(TICKER_CATEGORIES, CATEGORY_STYLES);
const CRYPTO_CARDS = toCategoryCards(CRYPTO_CATEGORIES, CRYPTO_STYLES);

/**
 * 업종 라벨만 보면 어느 시장인지 알 수 없다 — `반도체·IT`(한국)와 `AI·반도체`(미국)가 한 격자에
 * 섞이면 구분할 방법이 없다. 라벨마다 "한국"을 붙이는 대신 시장 탭이 한 번만 밝힌다.
 */
const isKrCard = (card: CategoryCard) =>
    KR_CATEGORY_IDS.has(card.id as CategoryId);
const US_CARDS = TICKER_CARDS.filter(card => !isKrCard(card));
const KR_CARDS = TICKER_CARDS.filter(isKrCard);

/** 홈의 인기 종목 — 시장 탭(기본 미국)과 업종 카드. 접힌 카드의 링크도 서버 HTML에 있다. */
export function PopularTickers() {
    const t = useTranslations('widgets.home');
    const markets: readonly {
        value: PopularPanel['value'];
        label: string;
        cards: readonly CategoryCard[];
    }[] = [
        { value: 'us', label: t('PopularTickers.us'), cards: US_CARDS },
        { value: 'kr', label: t('PopularTickers.kr'), cards: KR_CARDS },
        {
            value: 'crypto',
            label: t('PopularTickers.crypto'),
            cards: CRYPTO_CARDS,
        },
    ];
    // KR 카테고리가 비어 있으면 빈 탭이 남는다.
    const panels: PopularPanel[] = markets
        .filter(market => market.cards.length > 0)
        .map(({ value, label, cards }) => ({
            value,
            label,
            cardCount: cards.length,
            grid: (
                <CategoryCardGridBody
                    cards={cards}
                    watchlistSource="home_popular"
                />
            ),
        }));

    return (
        <nav
            id={HOME_POPULAR_ANCHOR_ID}
            aria-labelledby={HEADING_ID}
            className="page-container scroll-mt-20"
        >
            {/* 같은 위계의 h2는 `HEADING_SECTION` 한 곳에서만 정의한다
                (`shared/lib/typographyStyles.ts`). */}
            <h2 id={HEADING_ID} className={cn('mb-4', HEADING_SECTION)}>
                {t('PopularTickers.heading')}
            </h2>
            <PopularTickerTabs
                panels={panels}
                defaultTab="us"
                tabsLabel={t('PopularTickers.tabsLabel')}
                expandLabel={t('PopularTickers.expand')}
                collapseLabel={t('PopularTickers.collapse')}
            />
        </nav>
    );
}
