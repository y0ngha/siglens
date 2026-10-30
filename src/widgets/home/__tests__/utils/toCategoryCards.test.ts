import { toCategoryCards } from '../../utils/toCategoryCards';

const STYLES = {
    a: { borderColor: 'border-l-a', textColor: 'text-a' },
    b: { borderColor: 'border-l-b', textColor: 'text-b' },
} as const;

const ITEMS = [{ symbol: 'AAPL', name: '애플' }];

describe('toCategoryCards', () => {
    it('id·라벨·종목을 보존하고 id로 찾은 스타일을 펼친다', () => {
        const [card] = toCategoryCards(
            [{ id: 'b', label: '메이저', items: ITEMS }],
            STYLES
        );

        expect(card).toMatchObject({
            id: 'b',
            label: '메이저',
            borderColor: 'border-l-b',
            textColor: 'text-b',
            items: ITEMS,
        });
    });

    it('등록된 라벨은 번역 키(라벨·설명)를 싣고, 미등록 라벨은 키가 없다', () => {
        const [known, unknown] = toCategoryCards(
            [
                { id: 'a', label: '메이저', items: ITEMS },
                { id: 'b', label: '등록 안 된 라벨', items: ITEMS },
            ],
            STYLES
        );

        expect(known!.labelKey).toBeTruthy();
        expect(known!.descriptionKey).toBeTruthy();
        expect(unknown!.labelKey).toBeUndefined();
        expect(unknown!.descriptionKey).toBeUndefined();
    });

    it('입력 순서를 유지하고 빈 입력은 빈 배열이다', () => {
        const cards = toCategoryCards(
            [
                { id: 'b', label: 'x', items: [] },
                { id: 'a', label: 'y', items: [] },
            ],
            STYLES
        );

        expect(cards.map(c => c.id)).toEqual(['b', 'a']);
        expect(toCategoryCards([], STYLES)).toEqual([]);
    });
});
