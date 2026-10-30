import {
    applyCaseListVisibility,
    cardAttrs,
    CARD_ATTR,
    EMPTY_ATTR,
    isVisibleFor,
    UNFILTERED_TOKEN,
    VISIBILITY_ATTR,
    visibilityAttrs,
} from '../../utils/caseListVisibility';

describe('caseListVisibility', () => {
    it('visibilityAttrs는 토큰을 공백으로 이어 표기 속성 하나로 만든다', () => {
        expect(visibilityAttrs([UNFILTERED_TOKEN, 'AAPL'])).toEqual({
            [VISIBILITY_ATTR]: '* AAPL',
        });
    });

    it('cardAttrs는 표기 속성에 카드 표식을 더한다', () => {
        expect(cardAttrs([UNFILTERED_TOKEN, 'AAPL'])).toEqual({
            [VISIBILITY_ATTR]: '* AAPL',
            [CARD_ATTR]: '',
        });
    });

    it('isVisibleFor는 토큰 단위로만 일치시킨다(부분 문자열 아님)', () => {
        expect(isVisibleFor('* AAPL', 'AAPL')).toBe(true);
        expect(isVisibleFor('* AAPL', UNFILTERED_TOKEN)).toBe(true);
        expect(isVisibleFor('* AAPL', 'AAP')).toBe(false);
        expect(isVisibleFor('AAPL', UNFILTERED_TOKEN)).toBe(false);
    });
});

describe('applyCaseListVisibility', () => {
    function buildPanel(): HTMLElement {
        const panel = document.createElement('div');
        panel.innerHTML = `
            <p id="empty" hidden ${EMPTY_ATTR}></p>
            <div id="aapl" ${VISIBILITY_ATTR}="* AAPL" ${CARD_ATTR}></div>
            <div id="nvda" ${VISIBILITY_ATTR}="* NVDA" ${CARD_ATTR}></div>
        `;
        return panel;
    }
    const hiddenOf = (panel: HTMLElement, id: string) =>
        (panel.querySelector(`#${id}`) as HTMLElement).hidden;

    it('토큰에 맞는 요소만 보이게 한다', () => {
        const panel = buildPanel();
        applyCaseListVisibility(panel, 'AAPL');

        expect(hiddenOf(panel, 'aapl')).toBe(false);
        expect(hiddenOf(panel, 'nvda')).toBe(true);
        expect(hiddenOf(panel, 'empty')).toBe(true);
    });

    it('보이는 카드가 없으면 안내 요소를 드러낸다', () => {
        const panel = buildPanel();
        applyCaseListVisibility(panel, 'ZZZ');

        expect(hiddenOf(panel, 'aapl')).toBe(true);
        expect(hiddenOf(panel, 'nvda')).toBe(true);
        expect(hiddenOf(panel, 'empty')).toBe(false);
    });

    it('전체 토큰이면 모두 보이고 안내는 숨는다', () => {
        const panel = buildPanel();
        applyCaseListVisibility(panel, 'ZZZ');
        applyCaseListVisibility(panel, UNFILTERED_TOKEN);

        expect(hiddenOf(panel, 'aapl')).toBe(false);
        expect(hiddenOf(panel, 'nvda')).toBe(false);
        expect(hiddenOf(panel, 'empty')).toBe(true);
    });
});
