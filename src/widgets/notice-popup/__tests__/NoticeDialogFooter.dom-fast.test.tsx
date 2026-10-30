import { fireEvent, render, screen } from '@testing-library/react';
import { NoticeDialogFooter } from '../ui/dialog/NoticeDialogFooter';

describe('NoticeDialogFooter', () => {
    it('"다시 보지 않기"는 onDontShowAgain만 부른다', () => {
        const onDontShowAgain = vi.fn();
        const onClose = vi.fn();
        render(
            <NoticeDialogFooter
                onDontShowAgain={onDontShowAgain}
                onClose={onClose}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: '다시 보지 않기' }));
        expect(onDontShowAgain).toHaveBeenCalledTimes(1);
        expect(onClose).not.toHaveBeenCalled();
    });

    it('"닫기"는 onClose만 부른다', () => {
        const onDontShowAgain = vi.fn();
        const onClose = vi.fn();
        render(
            <NoticeDialogFooter
                onDontShowAgain={onDontShowAgain}
                onClose={onClose}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: '닫기' }));
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onDontShowAgain).not.toHaveBeenCalled();
    });

    it('두 버튼을 "다시 보지 않기", "닫기" 순서로 그린다', () => {
        render(
            <NoticeDialogFooter onDontShowAgain={vi.fn()} onClose={vi.fn()} />
        );
        expect(
            screen.getAllByRole('button').map(button => button.textContent)
        ).toEqual(['다시 보지 않기', '닫기']);
    });
});
