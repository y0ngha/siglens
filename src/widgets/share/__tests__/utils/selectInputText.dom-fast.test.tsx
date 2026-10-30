import type { MouseEvent } from 'react';
import {
    focusAndSelectInput,
    selectInputOnClick,
} from '../../utils/selectInputText';

function mountInput(value: string): HTMLInputElement {
    const input = document.createElement('input');
    input.value = value;
    document.body.appendChild(input);
    return input;
}

describe('selectInputText', () => {
    describe('focusAndSelectInput', () => {
        it('focuses the input and selects its whole value', () => {
            const input = mountInput('https://siglens.io/share/abc');

            focusAndSelectInput(input);

            expect(input).toHaveFocus();
            expect([input.selectionStart, input.selectionEnd]).toEqual([
                0,
                'https://siglens.io/share/abc'.length,
            ]);
            input.remove();
        });

        it('does nothing when the ref is detached (null)', () => {
            expect(() => focusAndSelectInput(null)).not.toThrow();
        });
    });

    describe('selectInputOnClick', () => {
        it('selects the whole value of the clicked input', () => {
            const input = mountInput('https://siglens.io/share/def');
            input.setSelectionRange(3, 5);

            selectInputOnClick({
                currentTarget: input,
            } as MouseEvent<HTMLInputElement>);

            expect([input.selectionStart, input.selectionEnd]).toEqual([
                0,
                'https://siglens.io/share/def'.length,
            ]);
            input.remove();
        });
    });
});
