/**
 * 홈 카드 18개가 **전부** 한 줄 설명을 갖는지 고정한다.
 *
 * 카테고리를 하나 추가하면서 `TICKER_CATEGORY_DESCRIPTION_KEY` 등록을 빠뜨리면
 * 그 카드만 조용히 설명 없이 나간다(화면은 안 깨진다). 라벨 맵과 같은 함정이라
 * 둘 다 여기서 본다.
 */
import { CRYPTO_CATEGORIES } from '@/shared/config/crypto-categories';
import { TICKER_CATEGORIES } from '@/shared/config/popular-tickers';
import { TICKER_CATEGORY_DESCRIPTION_KEY } from '@/shared/config/tickerCategoryLabel';
import koMessages from '@/../messages/ko.json';

const ALL_LABELS = [
    ...TICKER_CATEGORIES.map(c => c.label),
    ...CRYPTO_CATEGORIES.map(c => c.label),
];

describe('카테고리 설명 커버리지', () => {
    it.each(ALL_LABELS)('%s에 설명 키가 등록돼 있다', label => {
        expect(TICKER_CATEGORY_DESCRIPTION_KEY[label]).toBeDefined();
    });

    it.each(ALL_LABELS)('%s의 설명 키가 ko 카탈로그에 있다', label => {
        const key = TICKER_CATEGORY_DESCRIPTION_KEY[label]!;
        const name = key.split('.')[1]!;
        expect(koMessages.widgets.home.categoryDescription).toHaveProperty(
            name
        );
    });
});
