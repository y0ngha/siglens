import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { HoldingAmountField } from '../ui/HoldingAmountField';

function renderField(invalid: boolean) {
    const onValueChange = vi.fn();
    const inputRef = createRef<HTMLInputElement>();
    render(
        <HoldingAmountField
            id="holding-quantity"
            name="quantity"
            label="수량"
            placeholder="0"
            value=""
            onValueChange={onValueChange}
            inputRef={inputRef}
            invalid={invalid}
            errorId="holding-error"
        />
    );
    return { onValueChange, inputRef, input: screen.getByLabelText('수량') };
}

describe('HoldingAmountField', () => {
    it('invalid이면 aria-invalid를 켜고 aria-describedby가 에러 영역 id를 가리킨다', () => {
        const { input } = renderField(true);

        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(input).toHaveAttribute('aria-describedby', 'holding-error');
    });

    it('valid이면 aria-invalid가 false이고 aria-describedby가 없다', () => {
        const { input } = renderField(false);

        expect(input).toHaveAttribute('aria-invalid', 'false');
        expect(input).not.toHaveAttribute('aria-describedby');
    });

    it('입력한 문자열을 그대로 onValueChange로 넘기고 inputRef를 input에 붙인다', () => {
        const { input, inputRef, onValueChange } = renderField(false);

        fireEvent.change(input, { target: { value: '12.50' } });

        expect(onValueChange).toHaveBeenCalledExactlyOnceWith('12.50');
        expect(inputRef.current).toBe(input);
    });
});
