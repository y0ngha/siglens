/**
 * 홈 카드 18개가 **전부** 한 줄 설명을 갖는지 고정한다.
 *
 * 카테고리를 하나 추가하면서 `TICKER_CATEGORY_DESCRIPTION_KEY` 등록을 빠뜨리면
 * 그 카드만 조용히 설명 없이 나간다(화면은 안 깨진다). 라벨 맵과 같은 함정이라
 * 둘 다 여기서 본다.
 */
import { CRYPTO_CATEGORIES } from '@/shared/config/crypto-categories';
import { TICKER_CATEGORIES } from '@/shared/config/popular-tickers';
import {
    TICKER_CATEGORY_DESCRIPTION_KEY,
    TICKER_CATEGORY_LABEL_KEY,
} from '@/shared/config/tickerCategoryLabel';
import koMessages from '@/../messages/ko.json';
import enMessages from '@/../messages/en.json';
import jaMessages from '@/../messages/ja.json';
import zhMessages from '@/../messages/zh.json';

const LABEL_CATALOGS = {
    ko: koMessages,
    en: enMessages,
    ja: jaMessages,
    zh: zhMessages,
} as const;

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

    /**
     * 라벨 맵도 같은 함정이다 — 등록이 빠지면 영어·일본어·중국어 페이지에서 그 카드 제목만
     * 한국어 원문으로 떨어진다(`CategoryCardGrid`가 `labelKey` 없으면 `label`을 그린다).
     * 암호화폐 두 카드(`메이저`·`알트코인`)가 실제로 그렇게 빠져 있었다.
     */
    it.each(ALL_LABELS)('%s에 라벨 키가 등록돼 있다', label => {
        expect(TICKER_CATEGORY_LABEL_KEY[label]).toBeDefined();
    });

    describe.each(Object.entries(LABEL_CATALOGS))(
        '%s 카탈로그',
        (locale, catalog) => {
            it.each(ALL_LABELS)('%s의 라벨 키가 카탈로그에 있다', label => {
                const key = TICKER_CATEGORY_LABEL_KEY[label]!;
                const name = key.split('.')[1]!;
                expect(catalog.widgets.home.tickerCategory).toHaveProperty(
                    name
                );
            });

            if (locale !== 'ko') {
                it.each(ALL_LABELS)(
                    '%s의 라벨은 한국어 원문이 아니다',
                    label => {
                        const name =
                            TICKER_CATEGORY_LABEL_KEY[label]!.split('.')[1]!;
                        const table = catalog.widgets.home
                            .tickerCategory as Record<string, string>;
                        expect(table[name]).not.toMatch(/[가-힣]/);
                    }
                );
            }
        }
    );
});
