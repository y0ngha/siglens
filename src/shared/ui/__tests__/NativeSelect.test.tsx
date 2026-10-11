import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NativeSelect } from '@/shared/ui/NativeSelect';

describe('NativeSelect', () => {
    it('기본 화살표를 끄고 여백 안에 장식 아이콘을 그린다', () => {
        const { container } = render(
            <NativeSelect aria-label="정렬" defaultValue="b">
                <option value="a">A</option>
                <option value="b">B</option>
            </NativeSelect>
        );
        const select = screen.getByRole('combobox', { name: '정렬' });
        expect(select).toHaveClass('appearance-none', 'pr-9');
        expect(select).toHaveValue('b');
        expect(container.querySelector('svg')).toHaveAttribute(
            'aria-hidden',
            'true'
        );
    });

    it('select 속성과 이벤트를 그대로 넘기고 래퍼 클래스를 따로 받는다', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        const { container } = render(
            <NativeSelect
                aria-label="정렬"
                wrapperClassName="w-32"
                onChange={onChange}
            >
                <option value="a">A</option>
                <option value="b">B</option>
            </NativeSelect>
        );
        expect(container.firstElementChild).toHaveClass('w-32');
        await user.selectOptions(screen.getByRole('combobox'), 'b');
        expect(onChange).toHaveBeenCalledTimes(1);
    });
});
