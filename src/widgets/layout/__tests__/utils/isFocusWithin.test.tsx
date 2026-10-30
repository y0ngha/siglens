import { isFocusWithin } from '../../utils/isFocusWithin';

describe('isFocusWithin', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('포커스가 컨테이너 안의 요소에 있으면 true', () => {
        document.body.innerHTML = '<div id="c"><button id="in"></button></div>';
        document.getElementById('in')!.focus();

        expect(isFocusWithin(document.getElementById('c'))).toBe(true);
    });

    it('포커스가 컨테이너 밖에 있으면 false', () => {
        document.body.innerHTML =
            '<div id="c"></div><button id="out"></button>';
        document.getElementById('out')!.focus();

        expect(isFocusWithin(document.getElementById('c'))).toBe(false);
    });

    it('컨테이너가 없으면 false', () => {
        expect(isFocusWithin(null)).toBe(false);
    });
});
