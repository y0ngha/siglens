import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { LocaleTrigger } from '../../../ui/locale/LocaleTrigger';

const base = { menuId: 'm1', onClick: vi.fn() };

describe('LocaleTrigger', () => {
    it('이름에 현재 언어를 담고 보이는 글자를 포함한다', () => {
        render(
            <LocaleTrigger
                ref={createRef()}
                locale="ja"
                isOpen={false}
                isPending={false}
                showLabel
                {...base}
            />
        );

        const button = screen.getByRole('button', { name: '언어: 日本語' });
        expect(button).toHaveTextContent('日本語');
    });

    it('열려 있을 때만 aria-controls를 단다', () => {
        const { rerender } = render(
            <LocaleTrigger
                ref={createRef()}
                locale="ko"
                isOpen={false}
                isPending={false}
                showLabel={false}
                {...base}
            />
        );
        expect(screen.getByRole('button')).not.toHaveAttribute('aria-controls');

        rerender(
            <LocaleTrigger
                ref={createRef()}
                locale="ko"
                isOpen
                isPending={false}
                showLabel={false}
                {...base}
            />
        );
        expect(screen.getByRole('button')).toHaveAttribute(
            'aria-controls',
            'm1'
        );
    });

    it('radiogroup 팝업이므로 aria-haspopup을 달지 않는다', () => {
        render(
            <LocaleTrigger
                ref={createRef()}
                locale="ko"
                isOpen
                isPending={false}
                showLabel={false}
                {...base}
            />
        );

        expect(screen.getByRole('button')).not.toHaveAttribute('aria-haspopup');
    });

    it('전환 중이면 비활성이다', () => {
        render(
            <LocaleTrigger
                ref={createRef()}
                locale="ko"
                isOpen={false}
                isPending
                showLabel={false}
                {...base}
            />
        );

        expect(screen.getByRole('button')).toBeDisabled();
    });

    it('클릭을 전달한다', () => {
        const onClick = vi.fn();
        render(
            <LocaleTrigger
                ref={createRef()}
                locale="ko"
                isOpen={false}
                isPending={false}
                showLabel={false}
                menuId="m1"
                onClick={onClick}
            />
        );

        fireEvent.click(screen.getByRole('button'));

        expect(onClick).toHaveBeenCalledTimes(1);
    });
});
