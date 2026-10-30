import { fireEvent, render, screen } from '@testing-library/react';
import { LocaleRadioGroup } from '../../../ui/locale/LocaleRadioGroup';

describe('LocaleRadioGroup', () => {
    it('선택된 로케일만 탭 스톱(tabindex 0)이다', () => {
        render(
            <LocaleRadioGroup
                id="g"
                locale="en"
                align="end"
                onSelect={vi.fn()}
            />
        );

        expect(screen.getByRole('radio', { name: 'English' })).toHaveAttribute(
            'tabindex',
            '0'
        );
        expect(screen.getByRole('radio', { name: '한국어' })).toHaveAttribute(
            'tabindex',
            '-1'
        );
    });

    it('항목을 누르면 그 로케일로 onSelect한다', () => {
        const onSelect = vi.fn();
        render(
            <LocaleRadioGroup
                id="g"
                locale="ko"
                align="end"
                onSelect={onSelect}
            />
        );

        fireEvent.click(screen.getByRole('radio', { name: '日本語' }));

        expect(onSelect).toHaveBeenCalledWith('ja');
    });

    it('화살표 키는 포커스만 옮기고 선택하지 않는다', () => {
        const onSelect = vi.fn();
        render(
            <LocaleRadioGroup
                id="g"
                locale="ko"
                align="end"
                onSelect={onSelect}
            />
        );
        const radios = screen.getAllByRole('radio');
        radios[0]!.focus();

        fireEvent.keyDown(radios[0]!, { key: 'ArrowDown' });

        expect(radios[1]).toHaveFocus();
        expect(onSelect).not.toHaveBeenCalled();
    });

    it('화살표가 아닌 키는 가로채지 않는다', () => {
        render(
            <LocaleRadioGroup
                id="g"
                locale="ko"
                align="end"
                onSelect={vi.fn()}
            />
        );
        const radio = screen.getAllByRole('radio')[0]!;

        const notPrevented = fireEvent.keyDown(radio, { key: 'a' });

        expect(notPrevented).toBe(true);
    });

    it('현재 로케일 항목에만 체크 도형이 있다', () => {
        render(
            <LocaleRadioGroup
                id="g"
                locale="ko"
                align="end"
                onSelect={vi.fn()}
            />
        );

        const checked = screen
            .getAllByRole('radio')
            .filter(radio => radio.querySelector('svg') !== null);
        expect(checked).toHaveLength(1);
        expect(checked[0]).toHaveAttribute('aria-checked', 'true');
    });
});
